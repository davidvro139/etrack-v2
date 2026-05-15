import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Circle, ListChecks, Trash2, Plus, X } from 'lucide-react';
import api from '@/lib/api';
import { useFollowUps } from '@/hooks/useFollowUps';
import { useRole } from '@/hooks/useRole';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface Student { id: number; fullName: string; sisId: string; }

function dueBadge(dueDate: string, completedAt: string | null) {
  if (completedAt) return null;
  const diff = new Date(dueDate).getTime() - Date.now();
  const days = Math.ceil(diff / 86400000);
  if (days < 0) return <Badge variant="destructive">Overdue {Math.abs(days)}d</Badge>;
  if (days === 0) return <Badge variant="warning">Due today</Badge>;
  if (days <= 3) return <Badge variant="warning">Due in {days}d</Badge>;
  return null;
}

function AddFollowUpForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [note, setNote] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState('');

  const { data: students = [] } = useQuery<Student[]>({
    queryKey: ['students', '', false, false, false],
    queryFn: async () => {
      const { data } = await api.get('/students', { params: { archived: 'false' } });
      return data;
    },
    staleTime: 60_000,
  });

  const filtered = useMemo(() => {
    const q = studentSearch.toLowerCase();
    if (!q) return students.slice(0, 8);
    return students
      .filter((s) => s.fullName.toLowerCase().includes(q) || (s.sisId || '').toLowerCase().includes(q))
      .slice(0, 8);
  }, [students, studentSearch]);

  const addMutation = useMutation({
    mutationFn: () => api.post('/followups', { studentId: selectedStudent!.id, note, dueDate }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['followups'] });
      onClose();
    },
    onError: (e: any) => setError(e?.response?.data?.message || 'Failed to add follow-up'),
  });

  return (
    <div className="rounded-lg border border-border bg-card p-5 mb-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">New Follow-up</h2>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Student picker */}
      <div className="space-y-1.5">
        <Label>Student</Label>
        {selectedStudent ? (
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
            <span className="flex-1">{selectedStudent.fullName}</span>
            <button onClick={() => { setSelectedStudent(null); setStudentSearch(''); }}
              className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <Input
              placeholder="Search by name or student ID…"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              autoFocus
            />
            {filtered.length > 0 && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 rounded-md border border-border bg-card shadow-lg overflow-hidden">
                {filtered.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => { setSelectedStudent(s); setStudentSearch(''); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors border-b border-border last:border-0"
                  >
                    <span className="font-medium">{s.fullName}</span>
                    {s.sisId && <span className="text-muted-foreground ml-2 text-xs">{s.sisId}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Due Date</Label>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Note <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What to follow up on…" />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button
          onClick={() => addMutation.mutate()}
          disabled={!selectedStudent || !dueDate || addMutation.isPending}
        >
          {addMutation.isPending ? 'Saving…' : 'Add Follow-up'}
        </Button>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}

export default function TaskListPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { canWrite } = useRole();
  const [showForm, setShowForm] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  // Fetch all follow-ups (pending + completed) so the Show completed toggle works
  const { data: followups = [], isLoading } = useFollowUps(undefined, true);

  const completeMutation = useMutation({
    mutationFn: ({ id, completed }: { id: number; completed: boolean }) =>
      api.put(`/followups/${id}`, { completed }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['followups'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/followups/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['followups'] }),
  });

  const pending = followups.filter((f) => !f.completedAt);
  const completed = followups.filter((f) => f.completedAt);
  const overdue = pending.filter((f) => new Date(f.dueDate).getTime() < Date.now()).length;

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Follow-up Tasks</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {pending.length} pending{overdue > 0 ? ` · ${overdue} overdue` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowCompleted((v) => !v)}>
            {showCompleted ? 'Hide completed' : `Show completed (${completed.length})`}
          </Button>
          {canWrite && (
            <Button size="sm" onClick={() => setShowForm((v) => !v)}>
              <Plus className="h-4 w-4" />
              Add Follow-up
            </Button>
          )}
        </div>
      </div>

      {showForm && <AddFollowUpForm onClose={() => setShowForm(false)} />}

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!isLoading && pending.length === 0 && !showCompleted && !showForm && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <ListChecks className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm">No pending follow-ups</p>
          <button onClick={() => setShowForm(true)} className="text-xs text-primary hover:underline mt-2">
            Add one
          </button>
        </div>
      )}

      <div className="space-y-2">
        {[...pending, ...(showCompleted ? completed : [])].map((f) => {
          const isCompleted = !!f.completedAt;
          const overdue = !isCompleted && new Date(f.dueDate).getTime() < Date.now();
          return (
            <div
              key={f.id}
              className={cn(
                'flex items-start gap-3 rounded-lg border border-border p-4 transition-colors',
                isCompleted ? 'opacity-50' : overdue ? 'border-destructive/40 bg-destructive/5' : 'bg-card'
              )}
            >
              {canWrite ? (
                <button
                  onClick={() => completeMutation.mutate({ id: f.id, completed: !isCompleted })}
                  className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                  title={isCompleted ? 'Mark incomplete' : 'Mark complete'}
                >
                  {isCompleted
                    ? <CheckCircle2 className="h-5 w-5 text-green-500" />
                    : <Circle className="h-5 w-5" />
                  }
                </button>
              ) : (
                <span className="mt-0.5 shrink-0">
                  {isCompleted
                    ? <CheckCircle2 className="h-5 w-5 text-green-500 opacity-60" />
                    : <Circle className="h-5 w-5 opacity-30" />
                  }
                </span>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <button
                    onClick={() => navigate(`/students/${f.studentId}`)}
                    className="text-sm font-medium text-primary hover:underline truncate"
                  >
                    {f.studentName || `Student #${f.studentId}`}
                  </button>
                  {dueBadge(f.dueDate, f.completedAt)}
                </div>
                {f.note && <p className="text-sm text-muted-foreground">{f.note}</p>}
                <p className="text-xs text-muted-foreground mt-1">
                  Due {new Date(f.dueDate).toLocaleDateString()}
                  {f.createdByName ? ` · Added by ${f.createdByName}` : ''}
                  {isCompleted && f.completedAt
                    ? ` · Completed ${new Date(f.completedAt).toLocaleDateString()}`
                    : ''}
                </p>
              </div>

              {canWrite && (
                <button
                  onClick={() => deleteMutation.mutate(f.id)}
                  className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
