import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRole } from '@/hooks/useRole';
import { Plus, Trash2, Pencil } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const TYPE_COLORS: Record<string, 'default' | 'warning' | 'destructive' | 'secondary'> = {
  'Check-in': 'default',
  'Email': 'secondary',
  'Phone': 'secondary',
  'In Person': 'default',
  'Online': 'secondary',
  'Text': 'secondary',
  'Workshop': 'warning',
  'Advising': 'warning',
  'Other': 'outline' as any,
};

const TYPES = ['Check-in','Email','Phone','In Person','Online','Text','Workshop','Advising','Other'];

const emptyForm = { type: 'Check-in', notes: '' };

export default function InteractionsTab({ studentId }: { studentId: string }) {
  const { canWrite } = useRole();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const qc = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['interactions', studentId],
    queryFn: async () => {
      const { data } = await api.get(`/students/${studentId}/interactions`);
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      editing
        ? api.put(`/students/${studentId}/interactions/${editing._id}`, form)
        : api.post(`/students/${studentId}/interactions`, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['interactions', studentId] });
      qc.invalidateQueries({ queryKey: ['student-summary', Number(studentId)] });
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (iid: string) => api.delete(`/students/${studentId}/interactions/${iid}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['interactions', studentId] });
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
    setForm({ type: item.type, notes: item.notes || '' });
    setOpen(true);
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-muted-foreground">
          {items.length} interaction{items.length !== 1 ? 's' : ''}
        </h2>
        {canWrite && (
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4" />
            Log Interaction
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No interactions recorded yet.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item: any) => (
            <div key={item._id} className="flex items-start gap-3 rounded-lg border border-border p-4 bg-card">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={TYPE_COLORS[item.type] || 'secondary'}>{item.type}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(item.date).toLocaleDateString()} · {item.instructorName}
                  </span>
                </div>
                {item.notes && <p className="text-sm">{item.notes}</p>}
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
            <DialogTitle>{editing ? 'Edit Interaction' : 'Log Interaction'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3} placeholder="Optional…" />
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
