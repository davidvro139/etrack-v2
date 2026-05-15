import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowDown, ArrowUp, ArrowUpDown, Download, RefreshCw } from 'lucide-react';
import { downloadXlsx } from '@/lib/exportXlsx';
import api from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type SortKey =
  | 'studentName'
  | 'program'
  | 'lastCourse'
  | 'lastCourseEndDate'
  | 'lastCanvasActivity'
  | 'lastContactDate'
  | 'contactAttempts'
  | 'status';
type SortDirection = 'asc' | 'desc';

interface ReportRow {
  studentId: number;
  sisId: string | null;
  studentName: string;
  program: string;
  lastCourse: string;
  lastCourseEndDate: string | null;
  inactiveSince: string | null;
  graduationDate: string | null;
  statusNote: string;
  lastCanvasActivity: string | null;
  lastContactDate: string | null;
  lastContactType: string;
  lastContactBy: string;
  contactAttempts: number;
}

const SORT_LABELS: Record<SortKey, string> = {
  studentName: 'Student',
  program: 'Program',
  lastCourse: 'Last Course',
  lastCourseEndDate: 'Last Course End Date',
  lastCanvasActivity: 'Canvas',
  lastContactDate: 'Last Contact',
  contactAttempts: 'Attempts',
  status: 'Status',
};

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString() : '-';
}

function daysSince(value: string | null) {
  if (!value) return null;
  return Math.floor((Date.now() - new Date(value).getTime()) / 86400000);
}

function isOlderThanSixMonths(value: string | null) {
  if (!value) return false;
  const d = new Date(value);
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 6);
  return d < cutoff;
}

function compareText(a: unknown, b: unknown) {
  return String(a ?? '').localeCompare(String(b ?? ''), undefined, { sensitivity: 'base' });
}

function compareDate(a: unknown, b: unknown) {
  const left = a ? new Date(String(a)).getTime() : Number.POSITIVE_INFINITY;
  const right = b ? new Date(String(b)).getTime() : Number.POSITIVE_INFINITY;
  return left - right;
}

function statusLabel(row: ReportRow) {
  return row.graduationDate ? 'Graduated' : 'Inactive';
}

function compareRows(a: ReportRow, b: ReportRow, key: SortKey) {
  if (key === 'lastCanvasActivity' || key === 'lastContactDate' || key === 'lastCourseEndDate') {
    return compareDate(a[key], b[key]);
  }
  if (key === 'contactAttempts') return a.contactAttempts - b.contactAttempts;
  if (key === 'status') return compareText(statusLabel(a), statusLabel(b));
  return compareText(a[key], b[key]);
}

export default function InactiveReportPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [hideGraduates, setHideGraduates] = useState(true);
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'lastContactDate',
    direction: 'asc',
  });

  const { data = [], isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['inactive-report'],
    queryFn: async () => {
      const { data } = await api.get('/students/reports/inactive');
      return data as ReportRow[];
    },
  });

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = data.filter((row) => {
      if (hideGraduates && row.graduationDate) return false;
      if (!query) return true;
      return [row.studentName, row.sisId, row.program, row.lastCourse, row.statusNote]
        .some((value) => String(value ?? '').toLowerCase().includes(query));
    });

    return filtered
      .map((row, index) => ({ row, index }))
      .sort((a, b) => {
        const result = compareRows(a.row, b.row, sort.key);
        const directed = sort.direction === 'asc' ? result : -result;
        return directed || a.index - b.index;
      })
      .map(({ row }) => row);
  }, [data, hideGraduates, search, sort]);

  function toggleSort(key: SortKey) {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  }

  function SortHeader({ sortKey }: { sortKey: SortKey }) {
    const active = sort.key === sortKey;
    const Icon = !active ? ArrowUpDown : sort.direction === 'asc' ? ArrowUp : ArrowDown;
    return (
      <button
        type="button"
        onClick={() => toggleSort(sortKey)}
        className={`inline-flex items-center gap-1.5 font-medium transition-colors hover:text-foreground ${active ? 'text-foreground' : 'text-muted-foreground'}`}
      >
        {SORT_LABELS[sortKey]}
        <Icon className="h-3.5 w-3.5" />
      </button>
    );
  }

  return (
    <div className="p-6 flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div>
          <h1 className="text-2xl font-semibold">Inactive Student Report</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Inactive students who have not been archived.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => {
            const rows = visible.map((r) => ({
              'Student ID': r.sisId || '',
              'Name': r.studentName,
              'Program': r.program,
              'Last Course': r.lastCourse,
              'Last Course End': formatDate(r.lastCourseEndDate),
              'Status': statusLabel(r),
              'Status Note': r.statusNote,
              'Last Contact': formatDate(r.lastContactDate),
              'Contact Type': r.lastContactType,
              'Contact By': r.lastContactBy,
              'Contact Attempts': r.contactAttempts,
              'Last Canvas Activity': formatDate(r.lastCanvasActivity),
            }));
            downloadXlsx(rows, 'inactive-report', 'Inactive Students');
          }} disabled={visible.length === 0}>
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {isError && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm mb-4">
          <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <p className="text-destructive">{(error as any)?.message || 'Failed to load inactive report'}</p>
        </div>
      )}

      <div className="flex items-center gap-4 mb-4 shrink-0">
        <Input
          className="max-w-sm"
          placeholder="Filter inactive students..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className="flex items-center gap-1.5 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={hideGraduates}
            onChange={(e) => setHideGraduates(e.target.checked)}
          />
          Hide graduates
        </label>
        <span className="text-sm text-muted-foreground">
          {visible.length} of {data.length} students
        </span>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <RefreshCw className="h-10 w-10 mb-3 opacity-30 animate-spin" />
          <p className="text-sm">Loading inactive students...</p>
        </div>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No inactive, unarchived students found.</p>
      ) : (
        <div className="flex-1 overflow-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-muted/80 backdrop-blur">
                <th className="text-left px-4 py-3"><SortHeader sortKey="studentName" /></th>
                <th className="text-left px-4 py-3"><SortHeader sortKey="program" /></th>
                <th className="text-left px-4 py-3"><SortHeader sortKey="lastCourse" /></th>
                <th className="text-left px-4 py-3"><SortHeader sortKey="lastCourseEndDate" /></th>
                <th className="text-left px-4 py-3"><SortHeader sortKey="lastCanvasActivity" /></th>
                <th className="text-left px-4 py-3"><SortHeader sortKey="lastContactDate" /></th>
                <th className="text-left px-4 py-3"><SortHeader sortKey="contactAttempts" /></th>
                <th className="text-left px-4 py-3"><SortHeader sortKey="status" /></th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Note</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row, i) => {
                const canvasDays = daysSince(row.lastCanvasActivity);
                const contactDays = daysSince(row.lastContactDate);
                const staleEndDate = isOlderThanSixMonths(row.lastCourseEndDate);
                return (
                  <tr
                    key={row.studentId}
                    onClick={() => navigate(`/students/${row.studentId}`)}
                    className={`border-b border-border last:border-0 cursor-pointer hover:bg-accent/50 transition-colors ${i % 2 === 0 ? '' : 'bg-muted/20'}`}
                    title="Click to open student"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{row.studentName}</div>
                      <div className="text-xs text-muted-foreground font-mono">{row.sisId || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{row.program || '-'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.lastCourse || '-'}</td>
                    <td className="px-4 py-3 text-xs tabular-nums whitespace-nowrap">
                      <span className={staleEndDate ? 'text-red-400 font-semibold' : 'text-muted-foreground'}>
                        {formatDate(row.lastCourseEndDate)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums whitespace-nowrap">
                      <div>{formatDate(row.lastCanvasActivity)}</div>
                      {canvasDays !== null && <div className="text-muted-foreground">{canvasDays} days ago</div>}
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums whitespace-nowrap">
                      <div>{formatDate(row.lastContactDate)}</div>
                      {contactDays !== null && (
                        <div className={contactDays > 14 ? 'text-red-400' : 'text-muted-foreground'}>
                          {contactDays} days ago
                        </div>
                      )}
                      {row.lastContactType && (
                        <div className="text-muted-foreground">{row.lastContactType}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{row.contactAttempts}</td>
                    <td className="px-4 py-3">
                      <Badge variant={row.graduationDate ? 'success' : 'warning'}>{statusLabel(row)}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate">
                      {row.statusNote || '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
