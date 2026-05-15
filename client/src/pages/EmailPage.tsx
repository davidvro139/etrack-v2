import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Mail, Plus, Pencil, Trash2, Search, Send, CheckSquare, Square, ChevronRight, SkipForward, X } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface EmailTemplate { id: number; _id: number; name: string; subject: string; body: string; }
interface Student {
  id: number; _id: number; firstName: string; lastName: string; fullName: string;
  sisId: string; archived: boolean; inactive: boolean;
  enrollment: { program: string; currentCourse: string };
  contacts: { id: string; contactType: string; contactValue: string }[];
}

const PLACEHOLDERS = [
  { label: '{FirstName}', desc: 'First name' },
  { label: '{LastName}', desc: 'Last name' },
  { label: '{StudentId}', desc: 'Student ID' },
  { label: '{SchoolEmail}', desc: 'School email' },
  { label: '{PersonalEmail}', desc: 'Personal email' },
  { label: '{Program}', desc: 'Program' },
  { label: '{Course}', desc: 'Current course' },
];

function getContact(student: Student, ...types: string[]) {
  for (const type of types) {
    const val = student.contacts?.find(
      (c) => c.contactType?.toLowerCase() === type.toLowerCase()
    )?.contactValue;
    if (val) return val;
  }
  return '';
}

function fixCaps(name: string) {
  if (name === name.toUpperCase() && name.length > 1) {
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  }
  return name;
}

function resolve(text: string, student: Student, fixAllCaps: boolean) {
  const firstName = fixAllCaps ? fixCaps(student.firstName) : student.firstName;
  const lastName = fixAllCaps ? fixCaps(student.lastName) : student.lastName;
  return text
    .replace(/\{FirstName\}/gi, firstName)
    .replace(/\{LastName\}/gi, lastName)
    .replace(/\{StudentId\}/gi, student.sisId || String(student.id))
    .replace(/\{SchoolEmail\}/gi, getContact(student, 'SchoolEmail', 'GeneratedEmail'))
    .replace(/\{PersonalEmail\}/gi, getContact(student, 'PersonalEmail'))
    .replace(/\{Program\}/gi, student.enrollment?.program || '')
    .replace(/\{Course\}/gi, student.enrollment?.currentCourse || '');
}

function buildMailto(student: Student, subject: string, body: string, cc: string, fixAllCaps: boolean) {
  const to = getContact(student, 'SchoolEmail', 'GeneratedEmail');
  const resolvedSubject = resolve(subject, student, fixAllCaps);
  const resolvedBody = resolve(body, student, fixAllCaps);
  let uri = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(resolvedSubject)}&body=${encodeURIComponent(resolvedBody)}`;
  if (cc) uri += `&cc=${encodeURIComponent(cc)}`;
  return { uri, to, resolvedSubject, resolvedBody };
}

export default function EmailPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({ name: '', subject: '', body: '' });
  const [templateFocused, setTemplateFocused] = useState<'subject' | 'body'>('body');

  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [ccPersonal, setCcPersonal] = useState(false);
  const [fixAllCaps, setFixAllCaps] = useState(false);
  const [sendStatus, setSendStatus] = useState('');
  const [oneAtATime, setOneAtATime] = useState(false);
  const [sendQueue, setSendQueue] = useState<Student[]>([]);
  const [sendIndex, setSendIndex] = useState(0);
  const [sendOpened, setSendOpened] = useState(0);

  // --- Data ---
  const { data: templates = [] } = useQuery<EmailTemplate[]>({
    queryKey: ['email-templates'],
    queryFn: async () => { const { data } = await api.get('/email-templates'); return data; },
  });

  const { data: students = [] } = useQuery<Student[]>({
    queryKey: ['students-email'],
    queryFn: async () => {
      const { data } = await api.get('/students', { params: { archived: 'false', inactive: 'false' } });
      return data;
    },
  });

  const template = templates.find((t) => t.id === selectedTemplateId) || null;

  // CC = student's own personal email (not the instructor's)
  function studentCC(student: Student) {
    return ccPersonal ? getContact(student, 'PersonalEmail') : '';
  }

  const filtered = useMemo(() => {
    if (!search) return students;
    const q = search.toLowerCase();
    return students.filter((s) =>
      s.firstName?.toLowerCase().includes(q) ||
      s.lastName?.toLowerCase().includes(q) ||
      s.sisId?.includes(q) ||
      getContact(s, 'SchoolEmail', 'GeneratedEmail').toLowerCase().includes(q)
    );
  }, [students, search]);

  const selectedStudents = filtered.filter((s) => selectedIds.has(s.id));
  const previewStudent = selectedStudents[0] || filtered[0] || null;
  const allFilteredSelected = filtered.length > 0 && filtered.every((s) => selectedIds.has(s.id));

  // --- Template CRUD ---
  const templateMutation = useMutation({
    mutationFn: () =>
      editingTemplate
        ? api.put(`/email-templates/${editingTemplate.id}`, templateForm)
        : api.post('/email-templates', templateForm),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['email-templates'] });
      if (!editingTemplate) setSelectedTemplateId(res.data.id);
      setTemplateDialogOpen(false);
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/email-templates/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-templates'] });
      setSelectedTemplateId(null);
    },
  });

  function openNewTemplate() {
    setEditingTemplate(null);
    setTemplateForm({ name: '', subject: '', body: '' });
    setTemplateDialogOpen(true);
  }

  function openEditTemplate() {
    if (!template) return;
    setEditingTemplate(template);
    setTemplateForm({ name: template.name, subject: template.subject, body: template.body });
    setTemplateDialogOpen(true);
  }

  function insertPlaceholder(ph: string) {
    setTemplateForm((f) => {
      if (templateFocused === 'subject') return { ...f, subject: f.subject + ph };
      return { ...f, body: f.body + ph };
    });
  }

  // --- Selection ---
  function toggleStudent(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((s) => next.delete(s.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((s) => next.add(s.id));
        return next;
      });
    }
  }

  // --- Send one at a time ---
  function startOneAtATime() {
    if (!template || selectedIds.size === 0) return;
    const queue = students.filter((s) => selectedIds.has(s.id) && getContact(s, 'SchoolEmail', 'GeneratedEmail'));
    if (!queue.length) { setSendStatus('None of the selected students have a school email on file.'); return; }
    setSendQueue(queue);
    setSendIndex(0);
    setSendOpened(0);
    setSendStatus('');
  }

  function openCurrentAndAdvance() {
    const s = sendQueue[sendIndex];
    if (!s || !template) return;
    const { uri } = buildMailto(s, template.subject, template.body, studentCC(s), fixAllCaps);
    window.open(uri, '_blank');
    setSendOpened(n => n + 1);
    advance();
  }

  function advance() {
    const next = sendIndex + 1;
    if (next >= sendQueue.length) {
      setSendStatus(`Done — opened ${sendOpened + 1} email${sendOpened + 1 !== 1 ? 's' : ''}.`);
      setSendQueue([]);
    } else {
      setSendIndex(next);
    }
  }

  function skipCurrent() { advance(); }

  function cancelQueue() {
    setSendQueue([]);
    setSendIndex(0);
    setSendOpened(0);
  }

  // --- Send all ---
  function sendAll() {
    if (!template || selectedIds.size === 0) return;
    const toSend = students.filter((s) => selectedIds.has(s.id));
    const noEmail = toSend.filter((s) => !getContact(s, 'SchoolEmail', 'GeneratedEmail'));

    if (noEmail.length === toSend.length) {
      setSendStatus('None of the selected students have a school email on file.');
      return;
    }
    if (toSend.length > 15) {
      if (!confirm(`This will open ${toSend.length} compose windows. Continue?`)) return;
    }

    let opened = 0;
    for (const student of toSend) {
      const { uri, to } = buildMailto(student, template.subject, template.body, studentCC(student), fixAllCaps);
      if (!to) continue;
      window.open(uri, '_blank');
      opened++;
    }
    setSendStatus(`Opened ${opened} compose window${opened !== 1 ? 's' : ''}. Review and send each one.`);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border shrink-0">
        <h1 className="text-xl font-semibold">Email Students</h1>
      </div>

      {/* Template toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border shrink-0 bg-card/50">
        <span className="text-sm text-muted-foreground">Template:</span>
        <select
          className="flex-1 max-w-xs h-8 rounded-md border border-input bg-background text-foreground px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          value={selectedTemplateId ?? ''}
          onChange={(e) => setSelectedTemplateId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">— select a template —</option>
          {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <Button size="sm" variant="outline" onClick={openNewTemplate}><Plus className="h-3.5 w-3.5" />New</Button>
        <Button size="sm" variant="outline" onClick={openEditTemplate} disabled={!template}><Pencil className="h-3.5 w-3.5" />Edit</Button>
        <Button size="sm" variant="outline"
          className="text-destructive hover:text-destructive"
          disabled={!template}
          onClick={() => template && confirm(`Delete "${template.name}"?`) && deleteTemplateMutation.mutate(template.id)}>
          <Trash2 className="h-3.5 w-3.5" />Delete
        </Button>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — student list */}
        <div className="w-72 shrink-0 border-r border-border flex flex-col overflow-hidden">
          <div className="p-3 border-b border-border space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search students…" className="pl-9 h-8 text-sm"
                value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <button onClick={toggleAll}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-full">
              {allFilteredSelected
                ? <CheckSquare className="h-4 w-4 text-primary" />
                : <Square className="h-4 w-4" />}
              <span>Select all ({selectedStudents.length} selected)</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filtered.map((s) => {
              const email = getContact(s, 'SchoolEmail', 'GeneratedEmail');
              const checked = selectedIds.has(s.id);
              return (
                <button key={s.id} onClick={() => toggleStudent(s.id)}
                  className={cn(
                    'w-full text-left px-3 py-2 border-b border-border hover:bg-accent/50 transition-colors flex items-start gap-2',
                    checked && 'bg-accent/30'
                  )}>
                  {checked
                    ? <CheckSquare className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    : <Square className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{s.fullName}</p>
                    <p className={cn('text-xs truncate', email ? 'text-muted-foreground' : 'text-destructive/70')}>
                      {email || '(no email on file)'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="px-3 py-2 border-t border-border text-xs text-muted-foreground">
            {filtered.length} student{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Right — preview */}
        <div className="flex-1 overflow-y-auto p-6">
          {!template ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Mail className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">Select or create a template to get started</p>
            </div>
          ) : !previewStudent ? (
            <p className="text-sm text-muted-foreground">No students to preview</p>
          ) : (
            <div className="max-w-2xl space-y-4">
              <p className="text-xs text-muted-foreground">
                Preview for <span className="font-medium text-foreground">{previewStudent.fullName}</span>
              </p>

              <div className="rounded-lg border border-border bg-card overflow-hidden">
                <div className="border-b border-border px-4 py-2.5 flex gap-2 text-sm">
                  <span className="text-muted-foreground w-14 shrink-0">To:</span>
                  <span>{getContact(previewStudent, 'SchoolEmail') || <span className="text-destructive/70">(no email on file)</span>}</span>
                </div>
                <div className="border-b border-border px-4 py-2.5 flex gap-2 text-sm">
                  <span className="text-muted-foreground w-14 shrink-0">Cc:</span>
                  <span>{studentCC(previewStudent) || <span className="text-muted-foreground">(none)</span>}</span>
                </div>
                <div className="border-b border-border px-4 py-2.5 flex gap-2 text-sm">
                  <span className="text-muted-foreground w-14 shrink-0">Subject:</span>
                  <span>{resolve(template.subject, previewStudent, fixAllCaps) || <span className="text-muted-foreground">(no subject)</span>}</span>
                </div>
                <div className="px-4 py-3 text-sm whitespace-pre-wrap min-h-[120px]">
                  {resolve(template.body, previewStudent, fixAllCaps) || <span className="text-muted-foreground">(no body)</span>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Send bar */}
      {sendQueue.length > 0 ? (
        /* ── Send One at a Time mode ── */
        <div className="border-t border-border bg-card shrink-0">
          {/* Progress header */}
          <div className="flex items-center justify-between px-6 py-2 bg-muted/30 border-b border-border">
            <span className="text-xs text-muted-foreground font-medium">
              Sending one at a time — {sendIndex + 1} of {sendQueue.length}
            </span>
            <div className="flex gap-1">
              {sendQueue.map((_, i) => (
                <div key={i} className={cn('h-1.5 w-4 rounded-full', i < sendIndex ? 'bg-green-500' : i === sendIndex ? 'bg-primary' : 'bg-muted')} />
              ))}
            </div>
            <button onClick={cancelQueue} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Current student */}
          {(() => {
            const s = sendQueue[sendIndex];
            const email = getContact(s, 'SchoolEmail', 'GeneratedEmail');
            return (
              <div className="flex items-center gap-4 px-6 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{s.fullName}</p>
                  <p className="text-xs text-muted-foreground truncate">{email}</p>
                </div>
                <Button onClick={openCurrentAndAdvance} className="gap-2 shrink-0">
                  <Send className="h-4 w-4" />
                  Open in Email Client
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" onClick={skipCurrent} className="gap-1.5 shrink-0">
                  <SkipForward className="h-4 w-4" />
                  Skip
                </Button>
              </div>
            );
          })()}
        </div>
      ) : (
        /* ── Normal send bar ── */
        <div className="flex items-center gap-4 px-6 py-3 border-t border-border bg-card/50 shrink-0 flex-wrap">
          <Button onClick={sendAll} disabled={!template || selectedIds.size === 0} className="gap-2">
            <Send className="h-4 w-4" />
            Send All ({selectedIds.size})
          </Button>

          <Button
            variant="outline"
            onClick={startOneAtATime}
            disabled={!template || selectedIds.size === 0}
            className="gap-2"
          >
            <ChevronRight className="h-4 w-4" />
            Send One at a Time
          </Button>

          <div className="flex items-center gap-4 ml-auto">
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input type="checkbox" checked={ccPersonal} onChange={(e) => setCcPersonal(e.target.checked)} className="rounded" />
              CC student's personal email
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input type="checkbox" checked={fixAllCaps} onChange={(e) => setFixAllCaps(e.target.checked)} className="rounded" />
              Fix all-caps names
            </label>
          </div>

          {sendStatus && <p className="text-sm text-muted-foreground w-full">{sendStatus}</p>}
        </div>
      )}

      {/* Template editor dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Template' : 'New Template'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Template Name</Label>
              <Input value={templateForm.name}
                onChange={(e) => setTemplateForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Progress Check, Course Reminder…" />
            </div>

            {/* Placeholder buttons */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">Insert placeholder (click to add at cursor):</p>
              <div className="flex flex-wrap gap-1.5">
                {PLACEHOLDERS.map((p) => (
                  <button key={p.label} onClick={() => insertPlaceholder(p.label)}
                    title={p.desc}
                    className="px-2 py-0.5 rounded text-xs border border-border bg-muted hover:bg-accent transition-colors font-mono">
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input value={templateForm.subject}
                onFocus={() => setTemplateFocused('subject')}
                onChange={(e) => setTemplateForm((f) => ({ ...f, subject: e.target.value }))}
                placeholder="Subject line…" />
            </div>

            <div className="space-y-1.5">
              <Label>Body</Label>
              <Textarea value={templateForm.body}
                onFocus={() => setTemplateFocused('body')}
                onChange={(e) => setTemplateForm((f) => ({ ...f, body: e.target.value }))}
                placeholder="Email body…"
                rows={10}
                className="font-mono text-sm" />
            </div>

            {templateMutation.isError && (
              <p className="text-sm text-destructive">
                {(templateMutation.error as any)?.response?.data?.message || 'Save failed'}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => templateMutation.mutate()} disabled={templateMutation.isPending || !templateForm.name}>
                {templateMutation.isPending ? 'Saving…' : 'Save Template'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
