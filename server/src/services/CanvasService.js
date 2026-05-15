const axios = require('axios');
const { Op } = require('sequelize');
const Student = require('../models/Student');
const CourseProgress = require('../models/CourseProgress');
const LmsEngagement = require('../models/LmsEngagement');

const PACE_WEEKS = { FullTime: 1, PartTime: 2, HighSchool: 5 };

class CanvasService {
  constructor(siteUrl, token, courseFilter = '') {
    this.baseUrl = siteUrl.replace(/\/$/, '') + '/api/v1';
    this.headers = { Authorization: `Bearer ${token}` };
    this.courseFilter = courseFilter.trim().toUpperCase();
  }

  matchesCourseFilter(course) {
    if (!this.courseFilter) return true;
    return (course.name || '').toUpperCase().startsWith(this.courseFilter);
  }

  async get(path, params = {}) {
    const results = [];
    let url = `${this.baseUrl}${path}`;
    while (url) {
      const res = await axios.get(url, { headers: this.headers, params: { per_page: 100, ...params } });
      results.push(...res.data);
      const link = res.headers['link'] || '';
      const next = link.match(/<([^>]+)>;\s*rel="next"/);
      url = next ? next[1] : null;
      params = {};
    }
    return results;
  }

  async getAccount() {
    const accounts = await this.get('/accounts');
    return accounts[0];
  }

  async getActiveCourses(accountId) {
    const courses = await this.get(`/accounts/${accountId}/courses`, {
      enrollment_type: 'student',
      published: true,
    });
    return courses.filter((c) => this.matchesCourseFilter(c));
  }

  async getCourseModules(courseId) {
    return this.get(`/courses/${courseId}/modules`);
  }

  async getStudentModuleProgress(courseId, userId) {
    return this.get(`/courses/${courseId}/modules`, { student_id: userId });
  }

  async getCourseEnrollments(courseId) {
    return this.get(`/courses/${courseId}/enrollments`, {
      type: ['StudentEnrollment'],
      enrollment_state: 'active',
      'include[]': ['user', 'user_id'],
    });
  }

  async getStudentAnalytics(courseId, userId) {
    try {
      const res = await axios.get(
        `${this.baseUrl}/courses/${courseId}/analytics/users/${userId}/activity`,
        { headers: this.headers }
      );
      return res.data;
    } catch {
      return { page_views: {}, participations: [] };
    }
  }

  // onProgress callback: ({ current, total, message }) => void
  calcOnTrack(completedModules, totalModules, dueDate, courseStart) {
    const progressPercent = totalModules ? Math.round((completedModules / totalModules) * 100) : 0;

    if (!totalModules) return { state: 'Unknown', label: 'No modules', progressPercent: 0, expectedPercent: null };

    const pct = completedModules / totalModules;

    if (!dueDate) return { state: 'Unknown', label: `${progressPercent}%`, progressPercent, expectedPercent: null };

    const now = new Date();
    const end = new Date(dueDate);
    let expected;

    if (end < now && completedModules < totalModules) {
      return { state: 'Overdue', label: 'Overdue', progressPercent, expectedPercent: 100 };
    }

    if (courseStart) {
      // Use actual course date range for expected calculation
      const start = new Date(courseStart);
      const total = end - start;
      const elapsed = now - start;
      expected = Math.max(0, Math.min(1, elapsed / total));
    } else {
      // No start date — estimate: assume course end is the only reference
      // treat dueDate as deadline and now as some point in time
      // fall back to assuming 50% of time has elapsed if we can't determine
      expected = 0.5;
    }

    const expectedPercent = Math.round(expected * 100);

    let state, label;
    if (pct >= expected - 0.05) {
      state = 'OnTrack'; label = 'On Track';
    } else if (pct >= expected - 0.15) {
      state = 'SlightlyBehind'; label = 'Slightly Behind';
    } else {
      state = 'Behind'; label = 'Behind';
    }
    return { state, label, progressPercent, expectedPercent };
  }

  // Run up to `limit` async functions concurrently
  static async pLimit(fns, limit = 6) {
    const results = new Array(fns.length);
    for (let i = 0; i < fns.length; i += limit) {
      const batch = fns.slice(i, i + limit);
      const batchResults = await Promise.all(batch.map((fn) => fn()));
      batchResults.forEach((r, j) => { results[i + j] = r; });
    }
    return results;
  }

  async buildOnTrackReport(onProgress = () => {}) {
    const account = await this.getAccount();
    const courses = await this.getActiveCourses(account.id);
    const rows = [];

    // Load all students once — lookup maps keyed by various IDs:
    // 1. manually-set canvasUserId
    // 2. sisId matched against Canvas sis_user_id or login_id
    const allStudents = await Student.findAll({
      where: {
        archived: false,
        inactive: false,
        graduationDate: null,
      },
    });
    const studentByCanvasId = {};
    const studentBySisId = {};
    for (const s of allStudents) {
      if (s.enrollment?.canvasUserId) studentByCanvasId[String(s.enrollment.canvasUserId)] = s;
      if (s.sisId) studentBySisId[String(s.sisId)] = s;
    }

    // Load all CourseProgress records keyed by "studentId:courseId"
    // These contain the per-student per-course deadline from the original migration
    const allProgress = await CourseProgress.findAll({ where: { dueDate: { [Op.ne]: null } } });
    const progressMap = {};
    for (const p of allProgress) {
      progressMap[`${p.studentId}:${p.courseId}`] = p;
    }

    for (let ci = 0; ci < courses.length; ci++) {
      const course = courses[ci];
      onProgress({ current: ci + 1, total: courses.length, message: course.name });

      const [enrollments, modules] = await Promise.all([
        this.getCourseEnrollments(course.id),
        this.getCourseModules(course.id),
      ]);
      const totalModules = modules.length;

      // Fetch all student module progress for this course in parallel (max 6 at once)
      const courseRows = await CanvasService.pLimit(
        enrollments.map((enrollment) => async () => {
          const userId = enrollment.user_id;
          // Match by: manually-set canvasUserId → sis_user_id → login_id (often = school SIS ID)
          const sisCid = enrollment.user?.sis_user_id;
          const loginId = enrollment.user?.login_id;
          const student = studentByCanvasId[String(userId)]
            || (sisCid ? studentBySisId[String(sisCid)] : null)
            || (loginId ? studentBySisId[String(loginId)] : null)
            || null;

          // Priority: fresh enrollment dates (from Northstar import) →
          //           CourseProgress.dueDate (from original migration) →
          //           Canvas course end date
          if (!student) return null;

          const userModules = await this.getStudentModuleProgress(course.id, userId);
          const completedModules = userModules.filter((m) => m.state === 'completed').length;

          const progressRecord = progressMap[`${student.id}:${String(course.id)}`] || null;
          const dueDate = student?.enrollment?.courseStopDate
            || student?.enrollment?.gradDate
            || progressRecord?.dueDate
            || course.end_at
            || null;
          const courseStart = student?.enrollment?.courseStartDate
            || course.start_at
            || null;

          const onTrack = this.calcOnTrack(completedModules, totalModules, dueDate, courseStart);

          return {
            canvasUserId: userId,
            canvasUserName: enrollment.user?.name || String(userId),
            studentId: student.id,
            studentName: student.fullName,
            courseId: String(course.id),
            courseName: course.name,
            totalModules,
            completedModules,
            dueDate: dueDate || null,
            lastActive: enrollment.last_activity_at || null,
            ...onTrack,
          };
        }),
        6
      );

      rows.push(...courseRows.filter(Boolean));
    }
    return rows;
  }

  async syncToDatabase() {
    const account = await this.getAccount();
    const courses = await this.getActiveCourses(account.id);
    let synced = 0;

    const allStudents = await Student.findAll();
    const syncByCanvasId = {};
    const syncBySisId = {};
    for (const s of allStudents) {
      if (s.enrollment?.canvasUserId) syncByCanvasId[String(s.enrollment.canvasUserId)] = s;
      if (s.sisId) syncBySisId[String(s.sisId)] = s;
    }

    for (const course of courses) {
      const enrollments = await this.getCourseEnrollments(course.id);
      const modules = await this.getCourseModules(course.id);
      const totalModules = modules.length;

      for (const enrollment of enrollments) {
        const userId = enrollment.user_id;
        const sisCid = enrollment.user?.sis_user_id;
        const loginId = enrollment.user?.login_id;
        const student = syncByCanvasId[String(userId)]
          || (sisCid ? syncBySisId[String(sisCid)] : null)
          || (loginId ? syncBySisId[String(loginId)] : null)
          || null;
        if (!student) continue;

        const userModules = await this.getStudentModuleProgress(course.id, userId);
        const completedModules = userModules.filter((m) => m.state === 'completed').length;

        await CourseProgress.upsert({
          studentId: student.id,
          courseId: String(course.id),
          courseName: course.name,
          totalModules,
          completedModules,
          lastSyncedAt: new Date(),
        });

        const activity = await this.getStudentAnalytics(course.id, userId);
        const pageViews = Object.values(activity.page_views || {}).reduce((a, b) => a + b, 0);
        const participations = (activity.participations || []).length;

        await LmsEngagement.upsert({
          studentId: student.id,
          courseId: String(course.id),
          pageViews,
          participations,
          lastSyncedAt: new Date(),
        });
        synced++;
      }
    }
    return { synced, courses: courses.length };
  }

  // --- Reflection Grader ---

  async getTeacherCourses() {
    const params = new URLSearchParams({
      per_page: '100',
      enrollment_type: 'teacher',
    });
    params.append('state[]', 'available');
    const res = await axios.get(`${this.baseUrl}/courses?${params}`, { headers: this.headers });
    const courses = res.data || [];
    return courses.filter((c) => this.matchesCourseFilter(c));
  }

  async getCourseReflectionSubmissions(courseId) {
    const params = new URLSearchParams({ per_page: '100', enrollment_state: 'active' });
    params.append('student_ids[]', 'all');
    params.append('include[]', 'user');
    params.append('include[]', 'assignment');
    params.append('include[]', 'submission_history');
    params.append('workflow_state[]', 'submitted');
    params.append('workflow_state[]', 'pending_review');

    const res = await axios.get(
      `${this.baseUrl}/courses/${courseId}/students/submissions?${params}`,
      { headers: this.headers }
    );
    return res.data || [];
  }

  // Strip HTML tags and decode common entities
  static cleanText(html) {
    if (!html) return '';
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  async getUngradedReflections() {
    const courses = await this.getTeacherCourses();
    const reflections = [];

    for (const course of courses) {
      let submissions;
      try {
        submissions = await this.getCourseReflectionSubmissions(course.id);
      } catch {
        continue;
      }

      const reflectionSubs = submissions.filter(
        (s) => s.assignment?.name?.toLowerCase().includes('reflection')
      );

      for (const sub of reflectionSubs) {
        const quizMatch = sub.body?.match(/quiz:\s*(\d+)/i);
        const quizId = quizMatch ? quizMatch[1] : null;
        const history = sub.submission_history?.[0];
        const submissionData = history?.submission_data || [];

        // Canvas grade endpoint needs quiz_submission_id, not submission id
        const quizSubmissionId = sub.quiz_submission_id
          ? String(sub.quiz_submission_id)
          : history?.id
          ? String(history.id)
          : String(sub.id);

        const clean = CanvasService.cleanText;
        reflections.push({
          submissionId: quizSubmissionId,
          courseId: String(course.id),
          courseName: course.name,
          studentName: sub.user?.name || String(sub.user_id),
          canvasUserId: String(sub.user_id),
          assignmentId: String(sub.assignment_id),
          assignmentName: sub.assignment?.name || '',
          submittedAt: sub.submitted_at,
          quizId,
          attempt: history?.attempt || 1,
          answers: {
            courseDeadline: clean(submissionData[0]?.text),
            onTrack: clean(submissionData[1]?.text),
            daysAttended: clean(submissionData[2]?.text),
            learned: clean(submissionData[3]?.text),
            challenge: clean(submissionData[4]?.text),
            anyQuestions: clean(submissionData[5]?.text),
          },
          questions: submissionData.map((q) => ({
            id: q.question_id,
            text: clean(q.text),
          })),
        });
      }
    }

    // Sort by submittedAt descending
    reflections.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
    return reflections;
  }

  async gradeReflection(courseId, quizId, submissionId, attempt, questionIds, pass, comment) {
const score = pass ? 6 : 0;
    const questions = {};
    for (const qId of questionIds) {
      questions[qId] = { score, comment: comment || '' };
    }
    const res = await axios.put(
      `${this.baseUrl}/courses/${courseId}/quizzes/${quizId}/submissions/${submissionId}`,
      { quiz_submissions: [{ attempt, questions }] },
      { headers: this.headers }
    );
    return res.data;
  }
}

module.exports = CanvasService;
