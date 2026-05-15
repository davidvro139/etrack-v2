import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRole } from '@/hooks/useRole';
import { Plus, Trash2, Pencil } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Contact {
  id: string;
  contactType: string;
  contactValue: string;
}

interface Props {
  studentId: string;
  contacts: Contact[];
}

const CONTACT_TYPES = ['Phone', 'Cell', 'Email', 'Address', 'Emergency', 'Other'];

const emptyForm = { contactType: 'Phone', contactValue: '' };

export default function ContactsTab({ studentId, contacts = [] }: Props) {
  const { canWrite } = useRole();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState(emptyForm);
  const qc = useQueryClient();

  function saveContacts(updated: Contact[]) {
    return api.put(`/students/${studentId}`, { contacts: updated });
  }

  const mutation = useMutation({
    mutationFn: (updated: Contact[]) => saveContacts(updated),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['student', studentId] });
      qc.invalidateQueries({ queryKey: ['student-summary', Number(studentId)] });
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
    },
  });

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(c: Contact) {
    setEditing(c);
    setForm({ contactType: c.contactType, contactValue: c.contactValue });
    setOpen(true);
  }

  function handleSave() {
    if (!form.contactValue.trim()) return;
    let updated: Contact[];
    if (editing) {
      updated = contacts.map((c) =>
        c.id === editing.id ? { ...c, ...form } : c
      );
    } else {
      updated = [...contacts, { id: `${Date.now()}`, ...form }];
    }
    mutation.mutate(updated);
  }

  function handleDelete(id: string) {
    mutation.mutate(contacts.filter((c) => c.id !== id));
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-muted-foreground">
          {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
        </h2>
        {canWrite && (
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4" />
            Add Contact
          </Button>
        )}
      </div>

      {contacts.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No contacts recorded yet.</p>
      ) : (
        <div className="space-y-2">
          {contacts.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-lg border border-border p-3 bg-card">
              <div className="flex-1">
                <span className="text-xs font-medium text-muted-foreground mr-2">{c.contactType}</span>
                <span className="text-sm">{c.contactValue}</span>
              </div>
              {canWrite && <>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={() => openEdit(c)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(c.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>}
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Contact' : 'Add Contact'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.contactType} onValueChange={(v) => setForm((f) => ({ ...f, contactType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONTACT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Value</Label>
              <Input
                value={form.contactValue}
                onChange={(e) => setForm((f) => ({ ...f, contactValue: e.target.value }))}
                placeholder="Phone number, email address…"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={mutation.isPending || !form.contactValue.trim()}>
                {mutation.isPending ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
