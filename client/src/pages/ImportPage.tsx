import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, CheckCircle2, AlertCircle, RefreshCw, Lock } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useLastImport, importIsOverdue, importAgeLabel } from '@/hooks/useLastImport';
import { useAuthStore } from '@/store/auth';

type RowStatus = 'new' | 'update' | 'nochange' | 'error';

interface PreviewRow {
  sisId: string;
  firstName: string;
  lastName: string;
  program: string;
  catalogYear: string;
  currentCourse: string;
  objective: string;
  courseStartDate?: string | null;
  courseStopDate?: string | null;
  personalEmail: string;
  generatedEmail: string;
  studentId?: number;
  status: RowStatus;
  message: string;
  applied?: boolean;
}

interface Stats { total: number; new: number; update: number; nochange: number; error: number; }

const STATUS_LABEL: Record<RowStatus, string> = {
  new: 'New', update: 'Update', nochange: 'No Change', error: 'Error',
};

const STATUS_VARIANT: Record<RowStatus, 'success' | 'default' | 'secondary' | 'destructive'> = {
  new: 'success', update: 'default', nochange: 'secondary', error: 'destructive',
};

export default function ImportPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { data: lastImport } = useLastImport();

  if (user?.role === 'observer') {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full text-muted-foreground">
        <Lock className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm font-medium">Northstar Import is not available for observers.</p>
        <p className="text-xs mt-1">Contact an admin or instructor to import data.</p>
      </div>
    );
  }
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [hideNoChange, setHideNoChange] = useState(true);
  const [applyResult, setApplyResult] = useState<{ created: number; updated: number; errors: number } | null>(null);

  const previewMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post('/import/preview', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: (data) => {
      setRows(data.rows);
      setStats(data.stats);
      setApplyResult(null);
    },
  });

  const applyMutation = useMutation({
    mutationFn: () => {
      const toApply = rows.filter((r) => r.status === 'new' || r.status === 'update');
      return api.post('/import/apply', { rows: toApply });
    },
    onSuccess: ({ data }) => {
      setApplyResult(data);
      setRows((prev) =>
        prev.map((r) =>
          r.status === 'new' || r.status === 'update' ? { ...r, applied: true, status: r.status } : r
        )
      );
      queryClient.invalidateQueries({ queryKey: ['lastNorthstarImport'] });
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setRows([]);
    setStats(null);
    setApplyResult(null);
    previewMutation.mutate(file);
  }

  const visible = hideNoChange ? rows.filter((r) => r.status !== 'nochange') : rows;
  const canApply = rows.some((r) => (r.status === 'new' || r.status === 'update') && !r.applied);

  return (
    <div className="p-6 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="mb-6 shrink-0">
        <h1 className="text-2xl font-semibold">Northstar Import</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Import student and enrollment data from a Northstar XLSX export.
        </p>
        {lastImport !== undefined && (
          <p className={cn(
            'text-xs mt-1 flex items-center gap-1.5',
            importIsOverdue(lastImport) ? 'text-amber-500' : 'text-muted-foreground'
          )}>
            {importIsOverdue(lastImport) && <span className="h-1.5 w-1.5 rounded-full bg-amber-500 inline-block" />}
            Last import: {importAgeLabel(lastImport)}
            {importIsOverdue(lastImport) && ' — weekly import recommended'}
          </p>
        )}
      </div>

      {/* File picker */}
      <div className="flex items-center gap-3 mb-4 shrink-0">
        <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={handleFileChange} />
        <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={previewMutation.isPending}>
          <Upload className="h-4 w-4" />
          Choose XLSX…
        </Button>
        {fileName && <span className="text-sm text-muted-foreground">{fileName}</span>}
        {previewMutation.isPending && (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" /> Reading file…
          </span>
        )}
        {previewMutation.isError && (
          <span className="text-sm text-destructive">
            {(previewMutation.error as any)?.response?.data?.message || 'Failed to read file'}
          </span>
        )}
      </div>

      {/* Stats + filters */}
      {stats && (
        <div className="flex items-center gap-4 mb-3 shrink-0 flex-wrap">
          <div className="flex gap-3 text-sm">
            <span className="text-muted-foreground">Total: <strong className="text-foreground">{stats.total}</strong></span>
            <span className="text-green-400">New: <strong>{stats.new}</strong></span>
            <span className="text-primary">Update: <strong>{stats.update}</strong></span>
            <span className="text-muted-foreground">No Change: <strong>{stats.nochange}</strong></span>
            {stats.error > 0 && <span className="text-destructive">Errors: <strong>{stats.error}</strong></span>}
          </div>
          <label className="flex items-center gap-1.5 text-sm cursor-pointer ml-4">
            <input type="checkbox" checked={hideNoChange} onChange={(e) => setHideNoChange(e.target.checked)} />
            Hide no-change rows
          </label>
        </div>
      )}

      {/* Preview table */}
      {rows.length > 0 && (
        <div className="flex-1 overflow-auto rounded-lg border border-border mb-4">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-muted/80 backdrop-blur">
                <th className="text-left px-3 py-2 font-medium text-muted-foreground w-24">Status</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Student ID</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Program</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Course</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Year</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Start</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Stop</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Note</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row, i) => (
                <tr key={i} className={cn(
                  'border-b border-border last:border-0',
                  i % 2 === 0 ? '' : 'bg-muted/10',
                  row.applied && 'opacity-50'
                )}>
                  <td className="px-3 py-2">
                    <Badge variant={STATUS_VARIANT[row.status]}>
                      {row.applied ? 'Applied' : STATUS_LABEL[row.status]}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 font-medium">{row.firstName} {row.lastName}</td>
                  <td className="px-3 py-2 text-muted-foreground font-mono text-xs">{row.sisId}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.program}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.currentCourse}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.catalogYear}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {row.courseStartDate ? new Date(row.courseStartDate).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {row.courseStopDate ? new Date(row.courseStopDate).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{row.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Apply bar */}
      {rows.length > 0 && (
        <div className="flex items-center gap-4 shrink-0">
          <Button
            onClick={() => applyMutation.mutate()}
            disabled={!canApply || applyMutation.isPending}
          >
            {applyMutation.isPending
              ? <><RefreshCw className="h-4 w-4 animate-spin" />Applying…</>
              : <>Apply Updates ({rows.filter((r) => (r.status === 'new' || r.status === 'update') && !r.applied).length})</>
            }
          </Button>

          {applyResult && (
            <span className="flex items-center gap-1.5 text-sm text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              Done — {applyResult.created} created, {applyResult.updated} updated
              {applyResult.errors > 0 && <span className="text-destructive ml-1">({applyResult.errors} errors)</span>}
            </span>
          )}

          {applyMutation.isError && (
            <span className="flex items-center gap-1.5 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {(applyMutation.error as any)?.response?.data?.message || 'Apply failed'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
