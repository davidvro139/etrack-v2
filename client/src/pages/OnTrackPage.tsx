import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, AlertCircle, Download, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { downloadXlsx } from '@/lib/exportXlsx';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import StudentSummaryPanel from '@/components/StudentSummaryPanel';
import { cn } from '@/lib/utils';

const STATE_VARIANT: Record<string, 'success' | 'warning' | 'destructive' | 'outline'> = {
  OnTrack: 'success',
  SlightlyBehind: 'warning',
  Behind: 'destructive',
  Unknown: 'outline',
};

interface Progress { current: number; total: number; message: string; }

export default function OnTrackPage() {
  const { token, user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [progress, setProgress] = useState<Progress | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [sortCol, setSortCol] = useState<string>('studentName');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  function handleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  }

  const {
    data: rows = [],
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery<any[]>({
    queryKey: ['on-track-report'],
    queryFn: async () => {
      setProgress(null);

      const response = await fetch('/api/canvas/on-track', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || `Server error ${response.status}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalRows: any[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';
        for (const part of parts) {
          if (!part.startsWith('data: ')) continue;
          const data = JSON.parse(part.slice(6));
          if (data.type === 'progress') {
            setProgress({ current: data.current, total: data.total, message: data.message });
          } else if (data.type === 'done') {
            finalRows = data.rows;
            setProgress(null);
          } else if (data.type === 'error') {
            throw new Error(data.message);
          }
        }
      }
      return finalRows;
    },
    // Cache indefinitely — data persists across route changes until user explicitly refreshes
    staleTime: Infinity,
    gcTime: Infinity,
    enabled: false,
    retry: false,
  });


  const hasData = rows.length > 0;
  const canvasConfigured = !!(user?.canvasToken && user?.canvasSiteUrl);

  const STATUS_RANK: Record<string, number> = { OnTrack: 0, SlightlyBehind: 1, Behind: 2, Unknown: 3 };

  const filtered = useMemo(() => {
    const f = rows.filter((r) =>
      !search || r.studentName?.toLowerCase().includes(search.toLowerCase())
    );
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...f].sort((a, b) => {
      switch (sortCol) {
        case 'studentName': return dir * (a.studentName || '').localeCompare(b.studentName || '');
        case 'courseName':  return dir * (a.courseName || '').localeCompare(b.courseName || '');
        case 'progress':    return dir * ((a.progressPercent ?? 0) - (b.progressPercent ?? 0));
        case 'deadline':    return dir * ((a.dueDate ? new Date(a.dueDate).getTime() : 0) - (b.dueDate ? new Date(b.dueDate).getTime() : 0));
        case 'lastActive':  return dir * ((a.lastActive ? new Date(a.lastActive).getTime() : 0) - (b.lastActive ? new Date(b.lastActive).getTime() : 0));
        case 'status':      return dir * ((STATUS_RANK[a.state] ?? 9) - (STATUS_RANK[b.state] ?? 9));
        default: return 0;
      }
    });
  }, [rows, search, sortCol, sortDir]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h1 className="text-2xl font-semibold">On-Track Report</h1>
            {hasData && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {rows.length} students · click a row to view details
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasData && (
              <Button variant="outline" size="sm" onClick={() => {
                const rows = filtered.map((r: any) => ({
                  'Student': r.studentName,
                  'Course': r.courseName,
                  'Completed': r.completedModules ?? 0,
                  'Total Modules': r.totalModules ?? 0,
                  'Progress %': r.progressPercent ?? 0,
                  'Deadline': r.dueDate ? new Date(r.dueDate).toLocaleDateString() : '',
                  'Last Active': r.lastActive ? new Date(r.lastActive).toLocaleDateString() : '',
                  'Status': r.label,
                }));
                downloadXlsx(rows, 'on-track-report', 'On-Track Report');
              }}>
                <Download className="h-4 w-4" />
                Export
              </Button>
            )}
            <Button
              variant={hasData ? 'outline' : 'default'}
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching || !canvasConfigured}
            >
              <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
              {hasData ? 'Refresh' : 'Load Report'}
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Canvas not configured */}
          {!canvasConfigured && (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm mb-4">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-destructive">Canvas not configured</p>
                <p className="text-muted-foreground mt-0.5">Add your Canvas token and site URL in Settings.</p>
              </div>
            </div>
          )}

          {/* Error */}
          {isError && (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm mb-4">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-destructive">{(error as any)?.message || 'Failed to load'}</p>
            </div>
          )}

          {/* Progress bar */}
          {progress && (
            <div className="mb-6 rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">Loading from Canvas…</p>
                <span className="text-xs text-muted-foreground">{progress.current} / {progress.total} courses</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden mb-2">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground truncate">{progress.message}</p>
            </div>
          )}

          {/* Empty state */}
          {!hasData && !isFetching && !isError && canvasConfigured && (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <RefreshCw className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">Click "Load Report" to fetch data from Canvas</p>
            </div>
          )}

          {/* Table */}
          {hasData && !progress && (
            <>
              <div className="mb-4 max-w-sm">
                <Input
                  placeholder="Filter by student…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No students match your filter.</p>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        {([
                          ['studentName', 'Student'],
                          ['courseName',  'Course'],
                          ['progress',    'Progress'],
                          ['deadline',    'Deadline'],
                          ['lastActive',  'Last Active'],
                          ['status',      'Status'],
                        ] as [string, string][]).map(([col, label]) => (
                          <th key={col} className="text-left px-4 py-3 font-medium text-muted-foreground">
                            <button
                              onClick={() => handleSort(col)}
                              className="flex items-center gap-1 hover:text-foreground transition-colors"
                            >
                              {label}
                              {sortCol === col
                                ? sortDir === 'asc'
                                  ? <ChevronUp className="h-3.5 w-3.5" />
                                  : <ChevronDown className="h-3.5 w-3.5" />
                                : <ChevronsUpDown className="h-3.5 w-3.5 opacity-30" />
                              }
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((r: any, i: number) => {
                        const barColor = r.state === 'OnTrack' ? 'bg-green-500'
                          : r.state === 'SlightlyBehind' ? 'bg-yellow-500'
                          : r.state === 'Behind' ? 'bg-red-500'
                          : 'bg-muted-foreground';
                        const now = new Date();
                        const deadline = r.dueDate ? new Date(r.dueDate) : null;
                        const overdue = deadline ? deadline < now : false;
                        const lastActive = r.lastActive ? new Date(r.lastActive) : null;
                        const daysSinceActive = lastActive
                          ? Math.floor((now.getTime() - lastActive.getTime()) / 86400000)
                          : null;
                        const isSelected = selectedStudentId === r.studentId;

                        return (
                          <tr
                            key={`${r.canvasUserId}-${r.courseId}`}
                            onClick={() => r.studentId && setSelectedStudentId(
                              isSelected ? null : r.studentId
                            )}
                            className={cn(
                              'border-b border-border last:border-0 transition-colors',
                              r.studentId ? 'cursor-pointer' : '',
                              isSelected ? 'bg-accent' : i % 2 === 0 ? 'hover:bg-accent/50' : 'bg-muted/20 hover:bg-accent/50'
                            )}
                            title={r.studentId ? 'Click to view student details' : 'No local student record linked'}
                          >
                            <td className="px-4 py-3 font-medium">{r.studentName}</td>
                            <td className="px-4 py-3 text-muted-foreground text-sm">{r.courseName}</td>

                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-20 rounded-full bg-muted overflow-hidden shrink-0">
                                  <div className={`h-full rounded-full transition-all ${barColor}`}
                                    style={{ width: `${r.progressPercent ?? 0}%` }} />
                                </div>
                                <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                                  {r.completedModules ?? 0}/{r.totalModules ?? 0}
                                </span>
                              </div>
                            </td>

                            <td className="px-4 py-3 text-xs tabular-nums whitespace-nowrap">
                              {deadline
                                ? <span className={overdue ? 'text-red-400 font-semibold' : 'text-muted-foreground'}>
                                    {deadline.toLocaleDateString()}{overdue ? ' ⚠' : ''}
                                  </span>
                                : <span className="text-muted-foreground">—</span>
                              }
                            </td>

                            <td className="px-4 py-3 text-xs tabular-nums whitespace-nowrap">
                              {lastActive
                                ? <span className={
                                    daysSinceActive! > 14 ? 'text-red-400'
                                    : daysSinceActive! > 7 ? 'text-yellow-400'
                                    : 'text-muted-foreground'
                                  }>
                                    {lastActive.toLocaleDateString()}
                                  </span>
                                : <span className="text-muted-foreground">—</span>
                              }
                            </td>

                            <td className="px-4 py-3">
                              <Badge variant={STATE_VARIANT[r.state] || 'outline'}>{r.label}</Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Student summary panel — same as Students page */}
      {selectedStudentId !== null && (
        <StudentSummaryPanel
          studentId={selectedStudentId}
          onClose={() => setSelectedStudentId(null)}
        />
      )}
    </div>
  );
}
