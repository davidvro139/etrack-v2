import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRole } from '@/hooks/useRole';
import { Plus, Trash2, Pencil } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const STATUS_COLORS: Record<string, 'success' | 'warning' | 'secondary' | 'outline'> = {
  'Related Employment': 'success',
  'Related Placement': 'success',
  Employed: 'success',
  Seeking: 'warning',
  'Continuing Education': 'secondary',
  Other: 'outline',
  Unknown: 'outline',
};

const emptyForm = { employer: '', title: '', status: '', notes: '' };

export default function OutcomesTab({ studentId }: { studentId: string }) {
  const { canWrite } = useRole();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const qc = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['outcomes', studentId],
    queryFn: async () => {
      const { data } = await api.get(`/students/${studentId}/outcomes`);
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      editing
        ? api.put(`/students/${studentId}/outcomes/${editing._id}`, form)
        : api.post(`/students/${studentId}/outcomes`, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['outcomes', studentId] });
      qc.invalidateQueries({ queryKey: ['student-summary', Number(studentId)] });
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (oid: string) => api.delete(`/students/${studentId}/outcomes/${oid}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['outcomes', studentId] });
      qc.invalidateQueries({ queryKey: ['student-summary', Number(studentId)] });
    },
  });

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(item: any) {
    setEditing(item);
    setForm({ employer: item.employer || '', title: item.title || '', status: item.status || '', notes: item.notes || '' });
    setOpen(true);
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-muted-foreground">
          {items.length} outcome{items.length !== 1 ? 's' : ''}
        </h2>
        {canWrite && (
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4" />
            Add Outcome
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No outcomes recorded yet.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item: any) => (
            <div key={item._id} className="flex items-start gap-3 rounded-lg border border-border p-4 bg-card">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {item.status && <Badge variant={STATUS_COLORS[item.status] || 'outline'}>{item.status}</Badge>}
                  {item.employer && <span className="text-sm font-medium">{item.employer}</span>}
                  {item.title && <span className="text-sm text-muted-foreground">— {item.title}</span>}
                </div>
                {item.notes && <p className="text-sm text-muted-foreground">{item.notes}</p>}
              </div>
              {canWrite && <>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={() => openEdit(item)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteMutation.mutate(item._id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>}
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Outcome' : 'Add Outcome'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Input
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                placeholder="e.g. Related Employment, Seeking…"
                list="status-suggestions"
              />
              <datalist id="status-suggestions">
                <option value="Related Employment" />
                <option value="Related Placement" />
                <option value="Seeking" />
                <option value="Continuing Education" />
                <option value="Other" />
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label>Employer</Label>
              <Input value={form.employer} onChange={(e) => setForm((f) => ({ ...f, employer: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Job Title</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
