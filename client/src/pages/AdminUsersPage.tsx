import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface AppUser {
  id: number;
  name: string;
  email: string;
  role: string;
  active: boolean;
}


export default function AdminUsersPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'instructor' });
  const [formError, setFormError] = useState('');

  const { data: users = [], isLoading } = useQuery<AppUser[]>({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data } = await api.get('/users');
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/users', form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      setShowForm(false);
      setForm({ name: '', email: '', password: '', role: 'instructor' });
      setFormError('');
    },
    onError: (e: any) => setFormError(e?.response?.data?.message || 'Failed to create user'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<AppUser> }) =>
      api.put(`/users/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  function handleDelete(u: AppUser) {
    if (!confirm(`Delete "${u.name}" (${u.email})?\n\nThis cannot be undone.`)) return;
    deleteMutation.mutate(u.id);
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">User Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{users.length} users</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          <UserPlus className="h-4 w-4" />
          Add User
        </Button>
      </div>

      {showForm && (
        <div className="rounded-lg border border-border bg-card p-5 mb-6 space-y-4">
          <h2 className="text-sm font-semibold">New User</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="instructor">Instructor</option>
                <option value="observer">Observer</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          {formError && <p className="text-sm text-destructive">{formError}</p>}
          <div className="flex gap-2">
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating…' : 'Create User'}
            </Button>
            <Button variant="outline" onClick={() => { setShowForm(false); setFormError(''); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id} className={cn(
                  'border-b border-border last:border-0',
                  i % 2 === 0 ? '' : 'bg-muted/10',
                  !u.active && 'opacity-50'
                )}>
                  <td className="px-4 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      onChange={(e) => updateMutation.mutate({ id: u.id, data: { role: e.target.value } })}
                      className="text-xs bg-background border border-input rounded px-2 py-1 flex items-center gap-1"
                    >
                      <option value="instructor">Instructor</option>
                      <option value="observer">Observer</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {u.active !== false
                      ? <Badge variant="success">Active</Badge>
                      : <Badge variant="secondary">Deactivated</Badge>
                    }
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateMutation.mutate({ id: u.id, data: { active: u.active === false } })}
                      >
                        {u.active === false ? 'Reactivate' : 'Deactivate'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(u)}
                        disabled={deleteMutation.isPending}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        title="Delete user"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
