import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  student?: any;
}

function toDateInput(val: any): string {
  if (!val) return '';
  try { return new Date(val).toISOString().split('T')[0]; } catch { return ''; }
}

const defaultForm = {
  firstName: '',
  lastName: '',
  inactive: false,
  archived: false,
  graduationDate: '',
  statusNote: '',
  enrollment: {
    program: '',
    catalogYear: '',
    currentCourse: '',
    pace: 'PartTime',
    objective: '',
    gradDate: '',
    courseStartDate: '',
    courseStopDate: '',
    canvasUserId: '',
  },
};

function sectionLabel(text: string) {
  return (
    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2 pb-1 border-t border-border mt-2">
      {text}
    </p>
  );
}

export default function StudentFormDialog({ open, onOpenChange, student }: Props) {
  const isEdit = Boolean(student);
  const qc = useQueryClient();

  const [form, setForm] = useState<any>(defaultForm);

  // Sync form when student prop changes (edit mode)
  useEffect(() => {
    if (open) {
      if (student) {
        setForm({
          ...defaultForm,
          ...student,
          enrollment: {
            ...defaultForm.enrollment,
            ...(student.enrollment || {}),
            gradDate: toDateInput(student.enrollment?.gradDate),
            courseStartDate: toDateInput(student.enrollment?.courseStartDate),
            courseStopDate: toDateInput(student.enrollment?.courseStopDate),
          },
          graduationDate: toDateInput(student.graduationDate),
        });
      } else {
        setForm(defaultForm);
      }
    }
  }, [open, student]);

  const mutation = useMutation({
    mutationFn: (data: any) =>
      isEdit ? api.put(`/students/${student._id}`, data) : api.post('/students', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] });
      qc.invalidateQueries({ queryKey: ['student', String(student?._id)] });
      qc.invalidateQueries({ queryKey: ['student-summary'] });
      onOpenChange(false);
    },
  });

  function set(field: string, value: any) {
    setForm((f: any) => ({ ...f, [field]: value }));
  }

  function setEnr(field: string, value: any) {
    setForm((f: any) => ({ ...f, enrollment: { ...f.enrollment, [field]: value } }));
  }

  function setGraduated(checked: boolean) {
    const today = new Date().toISOString().split('T')[0];
    setForm((f: any) => ({
      ...f,
      inactive: checked ? true : f.inactive,
      graduationDate: checked ? (f.graduationDate || today) : null,
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate(form);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Student' : 'Add Student'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="overflow-y-auto flex-1 pr-1 space-y-3">

            {/* ── Basic Info ───────────────────────────────────── */}
            {sectionLabel('Basic Info')}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>First Name</Label>
                <Input value={form.firstName} onChange={(e) => set('firstName', e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Last Name</Label>
                <Input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} required />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Status Note</Label>
              <Textarea value={form.statusNote || ''} onChange={(e) => set('statusNote', e.target.value)}
                placeholder="Optional notes…" rows={2} />
            </div>

            {/* ── Status ───────────────────────────────────────── */}
            {sectionLabel('Status')}

            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={!!form.inactive}
                  onChange={(e) => set('inactive', e.target.checked)}
                  className="rounded" />
                Inactive
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={!!form.archived}
                  onChange={(e) => set('archived', e.target.checked)}
                  className="rounded" />
                Archived
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={!!form.graduationDate}
                  onChange={(e) => setGraduated(e.target.checked)}
                  className="rounded" />
                Graduated
              </label>
            </div>

            <div className="space-y-1.5">
              <Label>Graduation Date</Label>
              <Input type="date" value={form.graduationDate || ''}
                onChange={(e) => set('graduationDate', e.target.value || null)} />
            </div>

            {/* ── Enrollment ───────────────────────────────────── */}
            {sectionLabel('Enrollment')}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Program</Label>
                <Input value={form.enrollment.program || ''} onChange={(e) => setEnr('program', e.target.value)}
                  placeholder="e.g. Software Development" />
              </div>
              <div className="space-y-1.5">
                <Label>Catalog Year</Label>
                <Input value={form.enrollment.catalogYear || ''} onChange={(e) => setEnr('catalogYear', e.target.value)}
                  placeholder="e.g. 2025" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Current Course</Label>
              <Input value={form.enrollment.currentCourse || ''} onChange={(e) => setEnr('currentCourse', e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Pace</Label>
                <Select value={form.enrollment.pace || 'PartTime'} onValueChange={(v) => setEnr('pace', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FullTime">Full Time</SelectItem>
                    <SelectItem value="PartTime">Part Time</SelectItem>
                    <SelectItem value="HighSchool">High School</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Objective</Label>
                <Input value={form.enrollment.objective || ''} onChange={(e) => setEnr('objective', e.target.value)}
                  placeholder="e.g. Certificate Seeker" list="objective-suggestions" />
                <datalist id="objective-suggestions">
                  <option value="Certificate Seeker" />
                  <option value="Personal Interest" />
                  <option value="Secondary" />
                </datalist>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Course Start Date</Label>
                <Input type="date" value={form.enrollment.courseStartDate || ''}
                  onChange={(e) => setEnr('courseStartDate', e.target.value || null)} />
              </div>
              <div className="space-y-1.5">
                <Label>Course Deadline</Label>
                <Input type="date" value={form.enrollment.courseStopDate || ''}
                  onChange={(e) => setEnr('courseStopDate', e.target.value || null)} />
              </div>
            </div>

          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-border mt-3 shrink-0">
            {mutation.isError && (
              <p className="text-sm text-destructive mb-2">
                {(mutation.error as any)?.response?.data?.message || 'Something went wrong'}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Add student'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
