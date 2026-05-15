import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRole } from '@/hooks/useRole';
import { Plus, CheckCircle2, Circle, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { useFollowUps } from '@/hooks/useFollowUps';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

function dueBadge(dueDate: string, completedAt: string | null) {
  if (completedAt) return null;
  const diff = new Date(dueDate).getTime() - Date.now();
  const days = Math.ceil(diff / 86400000);
  if (days < 0) return <Badge variant="destructive">Overdue {Math.abs(days)}d</Badge>;
  if (days === 0) return <Badge variant="warning">Due today</Badge>;
  if (days <= 3) return <Badge variant="warning">Due in {days}d</Badge>;
  return null;
}

export default function FollowUpsTab({ studentId }: { studentId: string }) {
  const { canWrite } = useRole();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [note, setNote] = useState('');
  const [dueDate, setDueDate] = useState('');

  const { data: followups = [], isLoading } = useFollowUps(Number(studentId));
  const pending = followups.filter((f) => !f.completedAt);
  const completed = followups.filter((f) => f.completedAt);

  const addMutation = useMutation({
    mutationFn: () => api.post('/followups', { studentId: Number(studentId), note, dueDate }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['followups'] });
      setShowForm(false);
      setNote('');
      setDueDate('');
    },
  });

  const completeMutation = useMutation({
    mutationFn: ({ id, completed }: { id: number; completed: boolean }) =>
      api.put(`/followups/${id}`, { completed }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['followups'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/followups/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['followups'] }),
  });

  return (
    <div className="pt-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {pending.length} pending{completed.length > 0 ? ` · ${completed.length} completed` : ''}
          </span>
          {completed.length > 0 && (
            <button
              onClick={() => setShowCompleted((v) => !v)}
              className="text-xs text-primary hover:underline"
            >
              {showCompleted ? 'Hide completed' : 'Show completed'}
            </button>
          )}
        </div>
        {canWrite && (
          <Button size="sm" variant="outline" onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4" />
            Add Follow-up
          </Button>
        )}
      </div>

      {showForm && (
        <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Note <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What to follow up on…" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => addMutation.mutate()} disabled={!dueDate || addMutation.isPending}>
              {addMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setShowForm(false); setNote(''); setDueDate(''); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!isLoading && followups.length === 0 && (
        <p className="text-sm text-muted-foreground py-4">No follow-ups recorded for this student.</p>
      )}

      <div className="space-y-2">
        {[...pending, ...(showCompleted ? completed : [])].map((f) => {
          const isCompleted = !!f.completedAt;
          const overdue = !isCompleted && new Date(f.dueDate).getTime() < Date.now();
          return (
            <div
              key={f.id}
              className={cn(
                'flex items-start gap-3 rounded-lg border border-border p-3',
                isCompleted ? 'opacity-50' : overdue ? 'border-destructive/40 bg-destructive/5' : ''
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
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">
                    {new Date(f.dueDate).toLocaleDateString()}
                  </span>
                  {dueBadge(f.dueDate, f.completedAt)}
                  {isCompleted && f.completedAt && (
                    <span className="text-xs text-muted-foreground">
                      Completed {new Date(f.completedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
                {f.note && <p className="text-sm text-muted-foreground mt-0.5">{f.note}</p>}
                {f.createdByName && (
                  <p className="text-xs text-muted-foreground mt-0.5">Added by {f.createdByName}</p>
                )}
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
