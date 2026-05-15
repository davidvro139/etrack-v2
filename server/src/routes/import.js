const router = require('express').Router();
const multer = require('multer');
const XLSX = require('xlsx');
const { protect, requireWrite } = require('../middleware/auth');
const Student = require('../models/Student');
const AppSetting = require('../models/AppSetting');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// Case-insensitive column finder — strips spaces, underscores, hyphens for fuzzy match
function normalizeColumnName(s) {
  return String(s ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function col(row, name) {
  const target = normalizeColumnName(name);
  const key = Object.keys(row).find((k) => normalizeColumnName(k) === target);
  return key !== undefined ? String(row[key] ?? '').trim() : '';
}

function rawCol(row, name) {
  const target = normalizeColumnName(name);
  const key = Object.keys(row).find((k) => normalizeColumnName(k) === target);
  return key !== undefined ? row[key] : undefined;
}

function normalizeFormula(formula) {
  return String(formula ?? '')
    .trim()
    .replace(/^=/, '')
    .replace(/^_xlfn\./i, '');
}

function cellValue(cell, options = {}) {
  if (!cell) return '';
  if (options.formulaFirst && cell.f) return `=${normalizeFormula(cell.f)}`;
  if (cell.v !== undefined && cell.v !== null && cell.v !== '') return cell.v;
  if (cell.w !== undefined && cell.w !== null && cell.w !== '') return cell.w;
  if (cell.f) return `=${normalizeFormula(cell.f)}`;
  return '';
}

function isDateColumn(header) {
  const normalized = normalizeColumnName(header);
  return normalized === 'currentschedstartdate' || normalized === 'currentschedstopdate';
}

function debugDateCells(sheet) {
  if (!sheet['!ref']) return;

  const range = XLSX.utils.decode_range(sheet['!ref']);
  const dateHeaders = [];

  for (let c = range.s.c; c <= range.e.c; c++) {
    const address = XLSX.utils.encode_cell({ r: range.s.r, c });
    const header = String(cellValue(sheet[address]) ?? '').trim();
    if (isDateColumn(header)) dateHeaders.push({ c, header });
  }


  let logged = 0;

  for (let r = range.s.r + 1; r <= range.e.r && logged < 10; r++) {
    for (const { c, header } of dateHeaders) {
      const address = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[address];
      const importedValue = cellValue(cell, { formulaFirst: true });
      if (!cell && r > range.s.r + 5) continue;
      if (!cell && importedValue === '') continue;

      logged++;
    }
  }

}

function sheetToRows(sheet) {
  if (!sheet['!ref']) return [];

  const range = XLSX.utils.decode_range(sheet['!ref']);
  const headers = [];

  for (let c = range.s.c; c <= range.e.c; c++) {
    const address = XLSX.utils.encode_cell({ r: range.s.r, c });
    const header = String(cellValue(sheet[address]) ?? '').trim();
    if (header) headers.push({ c, header });
  }

  const rows = [];
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const row = {};
    let hasValue = false;

    for (const { c, header } of headers) {
      const address = XLSX.utils.encode_cell({ r, c });
      const value = cellValue(sheet[address], { formulaFirst: isDateColumn(header) });
      row[header] = value;
      if (value !== undefined && value !== null && String(value).trim() !== '') hasValue = true;
    }

    if (hasValue) rows.push(row);
  }

  return rows;
}

function parseDate(val) {
  if (val === null || val === undefined || val === '') return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;

  // Excel serial number
  if (typeof val === 'number' && val > 1) {
    const d = new Date(Math.round((val - 25569) * 86400000));
    return isNaN(d.getTime()) ? null : d;
  }

  const s = String(val).trim();
  if (!s) return null;

  // Excel DATE formula: =DATE(2026,6,12) or DATE(2026,6,12)
  const formula = s.match(/^=?(?:_xlfn\.)?DATE\s*\(\s*(\d{4})\s*[,;]\s*(\d{1,2})\s*[,;]\s*(\d{1,2})\s*\)$/i);
  if (formula) {
    const d = new Date(parseInt(formula[1]), parseInt(formula[2]) - 1, parseInt(formula[3]));
    return isNaN(d.getTime()) ? null : d;
  }

  // MM-DD-YYYY or MM/DD/YYYY
  const mdy = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (mdy) {
    const d = new Date(parseInt(mdy[3]), parseInt(mdy[1]) - 1, parseInt(mdy[2]));
    return isNaN(d.getTime()) ? null : d;
  }

  // YYYY-MM-DD or any other parseable format
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function eq(a, b) {
  return String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();
}

function dateEq(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return new Date(a).toDateString() === new Date(b).toDateString();
}

// POST /api/import/preview
router.post('/preview', protect, requireWrite, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer',
      cellFormula: true,
      sheetStubs: true,
      cellText:false, 
      cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    const rawRows = sheetToRows(sheet);

    if (!rawRows.length) return res.status(400).json({ message: 'Spreadsheet appears to be empty' });


    const students = await Student.findAll();
    const byId = Object.fromEntries(students.map((s) => [String(s.sisId), s]));

    const preview = [];

    for (const raw of rawRows) {
      const sisId = col(raw, 'StudentId');
      if (!sisId) {
        preview.push({
          sisId: '', firstName: col(raw, 'FirstName'), lastName: col(raw, 'LastName'),
          program: col(raw, 'Program'), catalogYear: col(raw, 'CatalogYear'),
          currentCourse: col(raw, 'EnrollIn'), objective: col(raw, 'EnrollObj'),
          courseStartDate: parseDate(rawCol(raw, 'CurrentSched_StartDate')),
          courseStopDate: parseDate(rawCol(raw, 'CurrentSched_StopDate')),
          personalEmail: col(raw, 'PersonalEmail'), generatedEmail: col(raw, 'GeneratedEmail'),
          status: 'error', message: 'Missing StudentId',
        });
        continue;
      }

      const incoming = {
        sisId,
        firstName: col(raw, 'FirstName'),
        lastName: col(raw, 'LastName'),
        program: col(raw, 'Program'),
        catalogYear: col(raw, 'CatalogYear'),
        currentCourse: col(raw, 'EnrollIn'),
        objective: col(raw, 'EnrollObj'),
        courseStartDate: parseDate(rawCol(raw, 'CurrentSched_StartDate')),
        courseStopDate: parseDate(rawCol(raw, 'CurrentSched_StopDate')),
        personalEmail: col(raw, 'PersonalEmail'),
        generatedEmail: col(raw, 'GeneratedEmail'),
      };

      const existing = byId[sisId];

      if (!existing) {
        preview.push({ ...incoming, status: 'new', message: 'New student' });
        continue;
      }

      const enr = existing.enrollment || {};
      const existingContacts = existing.contacts || [];
      const hasPersonalEmail = existingContacts.some((c) => c.contactType === 'PersonalEmail' && c.contactValue);
      const hasGeneratedEmail = existingContacts.some((c) => c.contactType === 'GeneratedEmail' && c.contactValue);

      const enrollmentChanged =
        !eq(enr.program, incoming.program) ||
        !eq(enr.catalogYear, incoming.catalogYear) ||
        !eq(enr.currentCourse, incoming.currentCourse) ||
        !eq(enr.objective, incoming.objective) ||
        !dateEq(enr.courseStopDate, incoming.courseStopDate) ||
        !dateEq(enr.courseStartDate, incoming.courseStartDate);

      const emailChanged =
        (incoming.personalEmail && !hasPersonalEmail) ||
        (incoming.generatedEmail && !hasGeneratedEmail);

      const nameChanged =
        !eq(existing.firstName, incoming.firstName) ||
        !eq(existing.lastName, incoming.lastName);

      if (enrollmentChanged || emailChanged || nameChanged) {
        preview.push({
          ...incoming,
          studentId: existing.id,
          status: 'update',
          message: [
            !eq(enr.currentCourse, incoming.currentCourse) && 'course',
            (!dateEq(enr.courseStopDate, incoming.courseStopDate) || !dateEq(enr.courseStartDate, incoming.courseStartDate)) && 'dates',
            (!eq(enr.program, incoming.program) || !eq(enr.catalogYear, incoming.catalogYear) || !eq(enr.objective, incoming.objective)) && 'enrollment',
            nameChanged && 'name',
            emailChanged && 'email',
          ].filter(Boolean).join(', ') + ' changed',
        });
      } else {
        preview.push({ ...incoming, studentId: existing.id, status: 'nochange', message: 'No changes' });
      }
    }

    const stats = {
      total: preview.length,
      new: preview.filter((r) => r.status === 'new').length,
      update: preview.filter((r) => r.status === 'update').length,
      nochange: preview.filter((r) => r.status === 'nochange').length,
      error: preview.filter((r) => r.status === 'error').length,
    };

    res.json({ rows: preview, stats });
  } catch (err) {
    next(err);
  }
});

// POST /api/import/apply
router.post('/apply', protect, requireWrite, async (req, res, next) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows)) return res.status(400).json({ message: 'rows array required' });

    const toApply = rows.filter((r) => r.status === 'new' || r.status === 'update');
    let created = 0, updated = 0, errors = 0;

    for (const row of toApply) {
      try {
        const enrollment = {
          program: row.program || '',
          catalogYear: row.catalogYear || '',
          currentCourse: row.currentCourse || '',
          objective: row.objective || '',
          courseStartDate: row.courseStartDate || null,
          courseStopDate: row.courseStopDate || null,
        };

        if (row.status === 'new') {
          const contacts = [];
          if (row.personalEmail) contacts.push({ id: `${Date.now()}-pe`, contactType: 'PersonalEmail', contactValue: row.personalEmail });
          if (row.generatedEmail) contacts.push({ id: `${Date.now()}-ge`, contactType: 'GeneratedEmail', contactValue: row.generatedEmail });
          await Student.create({
            sisId: row.sisId,
            firstName: row.firstName || '',
            lastName: row.lastName || '',
            enrollment,
            contacts,
          });
          created++;
        } else {
          const student = await Student.findByPk(row.studentId);
          if (!student) { errors++; continue; }

          const updates = { enrollment: { ...student.enrollment, ...enrollment } };
          if (row.firstName) updates.firstName = row.firstName;
          if (row.lastName) updates.lastName = row.lastName;

          const contacts = [...(student.contacts || [])];
          const hasPE = contacts.some((c) => c.contactType === 'PersonalEmail');
          const hasGE = contacts.some((c) => c.contactType === 'GeneratedEmail');
          if (row.personalEmail && !hasPE) contacts.push({ id: `${Date.now()}-pe`, contactType: 'PersonalEmail', contactValue: row.personalEmail });
          if (row.generatedEmail && !hasGE) contacts.push({ id: `${Date.now()}-ge`, contactType: 'GeneratedEmail', contactValue: row.generatedEmail });
          updates.contacts = contacts;

          await student.update(updates);
          updated++;
        }
      } catch {
        errors++;
      }
    }

    if (created + updated > 0) {
      await AppSetting.setSetting('lastNorthstarImport', new Date().toISOString());
    }
    res.json({ created, updated, errors });
  } catch (err) {
    next(err);
  }
});

// GET /api/import/last
router.get('/last', protect, async (req, res, next) => {
  try {
    const lastImport = await AppSetting.getSetting('lastNorthstarImport');
    res.json({ lastImport });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
