import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, UserX, User, UserMinus, GraduationCap, Download, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { downloadXlsx } from '@/lib/exportXlsx';
import { useRole } from '@/hooks/useRole';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import StudentFormDialog from '@/components/StudentFormDialog';
import StudentSummaryPanel from '@/components/StudentSummaryPanel';
import { cn } from '@/lib/utils';

interface Student {
  id: number;
  sisId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  archived: boolean;
  inactive: boolean;
  graduationDate: string | null;
  statusNote: string;
  enrollment: { program: string; currentCourse: string; pace: string; };
}

type SortCol = 'name' | 'program' | 'course' | 'pace' | 'status';
type SortDir = 'asc' | 'desc';

interface CtxMenu {
  x: number;
  y: number;
  student: Student;
}

export default function StudentsPage() {
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [showGraduated, setShowGraduated] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const [toast, setToast] = useState<string>('');

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }
  const [sortCol, setSortCol] = useState<SortCol>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const menuRef = useRef<HTMLDivElement>(null);
  const { canWrite } = useRole();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: students = [], isLoading } = useQuery<Student[]>({
    queryKey: ['students', search, showArchived, showInactive, showGraduated],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      params.archived = showArchived ? 'true' : 'false';
      if (!showArchived) {
        params.inactive = showInactive ? 'true' : 'false';
        params.graduated = showGraduated ? 'true' : 'false';
      }
      const { data } = await api.get('/students', { params });
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, any> }) =>
      api.put(`/students/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] });
      qc.invalidateQueries({ queryKey: ['student-summary'] });
    },
  });

  function handleSort(col: SortCol) {
    if (sortCol === col) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  }

  function statusRank(s: Student) {
    if (s.archived) return 3;
    if (s.graduationDate) return 2;
    if (s.inactive) return 1;
    return 0;
  }

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...students].sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case 'name':    cmp = a.fullName.localeCompare(b.fullName); break;
        case 'program': cmp = (a.enrollment?.program || '').localeCompare(b.enrollment?.program || ''); break;
        case 'course':  cmp = (a.enrollment?.currentCourse || '').localeCompare(b.enrollment?.currentCourse || ''); break;
        case 'pace':    cmp = (a.enrollment?.pace || '').localeCompare(b.enrollment?.pace || ''); break;
        case 'status':  cmp = statusRank(a) - statusRank(b); break;
      }
      return cmp * dir;
    });
  }, [students, sortCol, sortDir]);

  // Close context menu on outside click or scroll
  useEffect(() => {
    if (!ctxMenu) return;
    function close() { setCtxMenu(null); }
    document.addEventListener('click', close);
    document.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('scroll', close, true);
    };
  }, [ctxMenu]);

  function handleRowClick(id: number) {
    setSelectedId((prev) => (prev === id ? null : id));
  }

  function handleContextMenu(e: React.MouseEvent, student: Student) {
    e.preventDefault();
    if (!canWrite) return;
    setCtxMenu({ x: e.clientX, y: e.clientY, student });
  }

  function markInactive(s: Student) {
    const next = !s.inactive;
    updateMutation.mutate(
      { id: s.id, data: { inactive: next } },
      { onSuccess: () => showToast(next ? `${s.fullName} marked inactive` : `${s.fullName} marked active`) }
    );
    setCtxMenu(null);
  }

  function markArchived(s: Student) {
    const next = !s.archived;
    if (next && !confirm(`Archive ${s.fullName}? They will be hidden from the default list.`)) return;
    updateMutation.mutate(
      { id: s.id, data: { archived: next } },
      { onSuccess: () => showToast(next ? `${s.fullName} archived` : `${s.fullName} unarchived`) }
    );
    setCtxMenu(null);
  }

  function markGraduated(s: Student) {
    if (!confirm(`Mark ${s.fullName} as graduated?`)) return;
    updateMutation.mutate(
      { id: s.id, data: { graduationDate: new Date().toISOString() } },
      { onSuccess: () => showToast(`${s.fullName} marked as graduated`) }
    );
    setCtxMenu(null);
  }

  function handleExport() {
    const rows = sorted.map((s) => ({
      'Student ID': s.sisId || '',
      'First Name': s.firstName,
      'Last Name': s.lastName,
      'Program': s.enrollment?.program || '',
      'Current Course': s.enrollment?.currentCourse || '',
      'Pace': s.enrollment?.pace || '',
      'Status': s.archived ? 'Archived' : s.graduationDate ? 'Graduated' : s.inactive ? 'Inactive' : 'Active',
    }));
    downloadXlsx(rows, 'students', 'Students');
  }

  return (
    <div className="flex h-full overflow-hidden" onClick={() => setCtxMenu(null)}>
      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 shrink-0">
          <div>
            <h1 className="text-2xl font-semibold">Students</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {students.length} student{students.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExport} disabled={students.length === 0}>
              <Download className="h-4 w-4" />
              Export
            </Button>
            {canWrite && (
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                Add Student
              </Button>
            )}
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 mb-4 shrink-0">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or student ID…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant={showInactive ? 'secondary' : 'outline'} size="sm"
            onClick={() => setShowInactive((v) => !v)}>
            <UserMinus className="h-4 w-4" />
            {showInactive ? 'Hide inactive' : 'Show inactive'}
          </Button>
          <Button variant={showGraduated ? 'secondary' : 'outline'} size="sm"
            onClick={() => setShowGraduated((v) => !v)}>
            <GraduationCap className="h-4 w-4" />
            {showGraduated ? 'Hide graduated' : 'Show graduated'}
          </Button>
          <Button variant={showArchived ? 'secondary' : 'outline'} size="sm"
            onClick={() => setShowArchived((v) => !v)}>
            <UserX className="h-4 w-4" />
            {showArchived ? 'Hide archived' : 'Show archived'}
          </Button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : students.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <User className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">No students found</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    {([ ['name','Name'], ['program','Program'], ['course','Course'], ['pace','Pace'], ['status','Status'] ] as [SortCol, string][]).map(([col, label]) => (
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
                  {sorted.map((s, i) => (
                    <tr
                      key={s.id}
                      onClick={() => handleRowClick(s.id)}
                      onContextMenu={(e) => handleContextMenu(e, s)}
                      className={cn(
                        'cursor-pointer border-b border-border last:border-0 transition-colors',
                        selectedId === s.id
                          ? 'bg-accent'
                          : i % 2 === 0
                          ? 'hover:bg-accent/50'
                          : 'bg-muted/20 hover:bg-accent/50'
                      )}
                    >
                      <td className="px-4 py-3 font-medium">{s.fullName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{s.enrollment?.program || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{s.enrollment?.currentCourse || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{s.enrollment?.pace || '—'}</td>
                      <td className="px-4 py-3">
                        {s.archived ? (
                          <Badge variant="secondary">Archived</Badge>
                        ) : s.graduationDate ? (
                          <Badge variant="secondary">Graduated</Badge>
                        ) : s.inactive ? (
                          <Badge variant="warning">Inactive</Badge>
                        ) : (
                          <Badge variant="success">Active</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Right summary panel */}
      {selectedId !== null && (
        <StudentSummaryPanel
          studentId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}

      <StudentFormDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-card border border-border rounded-lg px-4 py-2.5 shadow-xl text-sm font-medium animate-in fade-in slide-in-from-bottom-2">
          {toast}
        </div>
      )}

      {/* Context menu */}
      {ctxMenu && (
        <div
          ref={menuRef}
          className="fixed z-50 bg-card border border-border rounded-md shadow-xl py-1 min-w-[200px]"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Student name header */}
          <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground border-b border-border mb-1 truncate">
            {ctxMenu.student.fullName}
          </div>

          {/* Open details */}
          <button
            onClick={() => { navigate(`/students/${ctxMenu.student.id}`); setCtxMenu(null); }}
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors"
          >
            Open Details
          </button>

          <div className="border-t border-border my-1" />

          {/* Inactive toggle */}
          <button
            onClick={() => markInactive(ctxMenu.student)}
            disabled={updateMutation.isPending}
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors flex items-center gap-2"
          >
            <span className={cn(
              'w-3 h-3 rounded-full shrink-0',
              ctxMenu.student.inactive ? 'bg-green-500' : 'bg-yellow-500'
            )} />
            {ctxMenu.student.inactive ? 'Mark as Active' : 'Mark as Inactive'}
          </button>

          {/* Archive toggle */}
          <button
            onClick={() => markArchived(ctxMenu.student)}
            disabled={updateMutation.isPending}
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors flex items-center gap-2"
          >
            <span className={cn(
              'w-3 h-3 rounded-full shrink-0',
              ctxMenu.student.archived ? 'bg-green-500' : 'bg-muted-foreground'
            )} />
            {ctxMenu.student.archived ? 'Unarchive' : 'Archive'}
          </button>

          {/* Graduate */}
          {!ctxMenu.student.graduationDate && (
            <button
              onClick={() => markGraduated(ctxMenu.student)}
              disabled={updateMutation.isPending}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors flex items-center gap-2"
            >
              <span className="w-3 h-3 rounded-full shrink-0 bg-blue-500" />
              Mark as Graduated
            </button>
          )}
          {ctxMenu.student.graduationDate && (
            <button
              onClick={() => {
                updateMutation.mutate({ id: ctxMenu.student.id, data: { graduationDate: null, inactive: false } });
                setCtxMenu(null);
              }}
              disabled={updateMutation.isPending}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors flex items-center gap-2"
            >
              <span className="w-3 h-3 rounded-full shrink-0 bg-muted-foreground" />
              Clear Graduation
            </button>
          )}
        </div>
      )}
    </div>
  );
}
