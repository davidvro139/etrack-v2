import { useState, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function SyncButton() {
  const [result, setResult] = useState('');
  const sync = useMutation({
    mutationFn: () => api.post('/canvas/sync'),
    onSuccess: ({ data }) => setResult(`Synced ${data.synced} students across ${data.courses} courses.`),
    onError: (e: any) => setResult(e?.response?.data?.message || 'Sync failed'),
  });
  return (
    <div className="flex items-center gap-3">
      <Button type="button" variant="outline" onClick={() => sync.mutate()} disabled={sync.isPending}>
        <RefreshCw className={`h-4 w-4 ${sync.isPending ? 'animate-spin' : ''}`} />
        {sync.isPending ? 'Syncing…' : 'Sync Now'}
      </Button>
      {result && <span className="text-xs text-muted-foreground">{result}</span>}
    </div>
  );
}

export default function SettingsPage() {
  const { user, setUser } = useAuthStore();
  const restoreRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user?.name || '');
  const [canvasToken, setCanvasToken] = useState(user?.canvasToken || '');
  const [canvasSiteUrl, setCanvasSiteUrl] = useState(user?.canvasSiteUrl || '');
  const [canvasCourseFilter, setCanvasCourseFilter] = useState(user?.canvasCourseFilter || '');
  const [saved, setSaved] = useState(false);
  const [backupMessage, setBackupMessage] = useState('');

  useEffect(() => {
    setName(user?.name || '');
    setCanvasToken(user?.canvasToken || '');
    setCanvasSiteUrl(user?.canvasSiteUrl || '');
    setCanvasCourseFilter(user?.canvasCourseFilter || '');
  }, [user]);

  const mutation = useMutation({
    mutationFn: () =>
      api.put('/users/me', { name, canvasToken, canvasSiteUrl, canvasCourseFilter }),
    onSuccess: ({ data }) => {
      setUser(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const backupMutation = useMutation({
    mutationFn: async () => {
      const response = await api.get('/database/backup', { responseType: 'blob' });
      const disposition = response.headers['content-disposition'] || '';
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] || `etrack-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      setBackupMessage('Backup saved.');
      setTimeout(() => setBackupMessage(''), 3000);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('backup', file);
      const { data } = await api.post('/database/restore', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: ({ counts }) => {
      const restored = Object.values(counts || {}).reduce((sum: number, count: any) => sum + Number(count || 0), 0);
      setBackupMessage(`Restore complete. ${restored} rows restored.`);
      if (restoreRef.current) restoreRef.current.value = '';
    },
  });

  function handleRestoreFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const ok = confirm(
      `Restore database from "${file.name}"?\n\nThis will replace the current ETrack database with the backup contents.`
    );
    if (!ok) {
      e.target.value = '';
      return;
    }

    restoreMutation.mutate(file);
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-semibold mb-6">Settings</h1>

      <div className="space-y-4">

        {/* Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Display Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Login Email</Label>
              <Input value={user?.email || ''} disabled className="opacity-60" />
            </div>
          </CardContent>
        </Card>

        {/* Canvas LMS */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Canvas LMS</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Canvas Site URL</Label>
              <Input
                value={canvasSiteUrl}
                onChange={(e) => setCanvasSiteUrl(e.target.value)}
                placeholder="https://yourschool.instructure.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Canvas API Token</Label>
              <Input
                type="password"
                value={canvasToken}
                onChange={(e) => setCanvasToken(e.target.value)}
                placeholder="Paste your Canvas token here"
              />
              <p className="text-xs text-muted-foreground">
                Generate in Canvas → Account → Settings → New Access Token
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Sync Canvas Data</Label>
              <p className="text-xs text-muted-foreground">
                Pulls module progress and engagement data from Canvas into the local database — populates the Progress tab on student detail pages.
              </p>
              <SyncButton />
            </div>

            <div className="space-y-1.5">
              <Label>Course Name Filter</Label>
              <Input
                value={canvasCourseFilter}
                onChange={(e) => setCanvasCourseFilter(e.target.value)}
                placeholder="e.g. TESD"
              />
              <p className="text-xs text-muted-foreground">
                Only process Canvas courses whose name starts with this text.
                Leave blank to include all courses. Speeds up the On-Track report and Reflection Grader significantly.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Database Backup — admin only */}
        {user?.role === 'admin' && <Card>
          <CardHeader>
            <CardTitle className="text-base">Database Backup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Save a JSON backup of the ETrack database, or restore from a previous backup file.
            </p>
            <input
              ref={restoreRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleRestoreFile}
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => backupMutation.mutate()}
                disabled={backupMutation.isPending || restoreMutation.isPending}
              >
                {backupMutation.isPending ? 'Saving Backup...' : 'Save Backup'}
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => restoreRef.current?.click()}
                disabled={backupMutation.isPending || restoreMutation.isPending}
              >
                {restoreMutation.isPending ? 'Restoring...' : 'Restore Backup'}
              </Button>
              {backupMessage && <span className="text-sm text-green-500">{backupMessage}</span>}
            </div>
            {(backupMutation.isError || restoreMutation.isError) && (
              <p className="text-sm text-destructive">
                {((backupMutation.error || restoreMutation.error) as any)?.response?.data?.message
                  || ((backupMutation.error || restoreMutation.error) as any)?.message
                  || 'Database backup action failed'}
              </p>
            )}
          </CardContent>
        </Card>}

        <div className="flex items-center gap-3">
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Save Settings'}
          </Button>
          {saved && <span className="text-sm text-green-500">Saved!</span>}
          {mutation.isError && (
            <span className="text-sm text-destructive">
              {(mutation.error as any)?.response?.data?.message || 'Save failed'}
            </span>
          )}
        </div>

      </div>
    </div>
  );
}
