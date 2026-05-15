import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Search, X } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// ── Hex geometry (flat-top, R=60) ─────────────────────────────────────────────
const R = 60;
const HEX_H = R * Math.sqrt(3); // 103.9

function hexPoints(cx: number, cy: number) {
  return [
    [cx + R, cy], [cx + R / 2, cy - R * 0.866],
    [cx - R / 2, cy - R * 0.866], [cx - R, cy],
    [cx - R / 2, cy + R * 0.866], [cx + R / 2, cy + R * 0.866],
  ].map(([x, y]) => `${x!.toFixed(1)},${y!.toFixed(1)}`).join(' ');
}

// ── Avatar layout ──────────────────────────────────────────────────────────────
const AVATAR_R = 12, AVATAR_S = 27, MAX_VISIBLE = 9;

function avatarPositions(count: number) {
  const n = Math.min(count, MAX_VISIBLE);
  const cols = n <= 3 ? n : n <= 6 ? Math.ceil(n / 2) : 3;
  const rows: number[] = [];
  let rem = n;
  while (rem > 0) { rows.push(Math.min(cols, rem)); rem -= cols; }
  const out: { x: number; y: number }[] = [];
  rows.forEach((rc, r) => {
    const y = r * AVATAR_S - (rows.length - 1) * AVATAR_S / 2;
    for (let c = 0; c < rc; c++)
      out.push({ x: c * AVATAR_S - (rc - 1) * AVATAR_S / 2, y });
  });
  return out;
}

function initials(f: string, l: string) {
  return `${(f || '').charAt(0)}${(l || '').charAt(0)}`.toUpperCase();
}

// ── Types ──────────────────────────────────────────────────────────────────────
interface GBStudent {
  id: number; sisId: string; firstName: string; lastName: string;
  isSoftDropped: boolean; indicatorColor: string;
}
interface GBCourse {
  courseKey: string; boardKey: string; courseName: string;
  students: GBStudent[]; x: number; y: number;
}

// ── Components ────────────────────────────────────────────────────────────────
function Diamond({ cx, cy, label }: { cx: number; cy: number; label: string }) {
  const s = AVATAR_R * 1.2;
  return (
    <g>
      <polygon points={`${cx},${cy - s} ${cx + s},${cy} ${cx},${cy + s} ${cx - s},${cy}`}
        fill="#F7E36D" stroke="#B4B4B4" strokeWidth="1" />
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize="9" fontWeight="bold" fill="#333"
        style={{ pointerEvents: 'none' }}>{label}</text>
    </g>
  );
}

function MoveDialog({ student, courses, onMove, onClose }:
  { student: GBStudent; courses: GBCourse[]; onMove: (n: string) => void; onClose: () => void }) {
  const [sel, setSel] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg p-5 w-80 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <p className="font-semibold mb-3">Move {student.firstName} {student.lastName}</p>
        <select className="w-full h-9 rounded border border-input bg-transparent px-2 text-sm mb-4 focus:outline-none focus:ring-1 focus:ring-ring"
          value={sel} onChange={(e) => setSel(e.target.value)}>
          <option value="">— select course —</option>
          {courses.map((c) => <option key={c.courseKey} value={c.courseName}>{c.courseName}</option>)}
        </select>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={!sel} onClick={() => onMove(sel)}>Move</Button>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function GameboardPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ boardKey: string; startMX: number; startMY: number; startX: number; startY: number } | null>(null);

  const [program, setProgram] = useState('');
  const [catalogYear, setCatalogYear] = useState('');
  const [zoom, setZoom] = useState(1);
  const [hexPos, setHexPos] = useState<Record<string, { x: number; y: number }>>({});
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [tooltip, setTooltip] = useState<{ x: number; y: number; course: GBCourse } | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; student: GBStudent; courseKey: string } | null>(null);
  const [moveTarget, setMoveTarget] = useState<{ student: GBStudent } | null>(null);

  // Programs
  const { data: programs = [] } = useQuery<string[]>({
    queryKey: ['gameboard-programs'],
    queryFn: async () => { const { data } = await api.get('/gameboard/programs'); return data; },
  });

  // Catalog years for selected program
  const { data: catalogYears = [] } = useQuery<string[]>({
    queryKey: ['gameboard-years', program],
    queryFn: async () => {
      const { data } = await api.get('/gameboard/catalog-years', { params: { program } });
      return data;
    },
  });

  // Auto-select latest year when years load
  useEffect(() => {
    if (catalogYears.length > 0 && !catalogYear) setCatalogYear(catalogYears[0]);
  }, [catalogYears]);

  // Auto-select first program
  useEffect(() => {
    if (programs.length > 0 && !program) setProgram(programs[0]);
  }, [programs]);

  // Clear year selection when program changes
  useEffect(() => { setCatalogYear(''); }, [program]);

  // Board data
  const { data, isLoading, refetch } = useQuery<{ courses: GBCourse[] }>({
    queryKey: ['gameboard', program, catalogYear],
    queryFn: async () => {
      const { data } = await api.get('/gameboard', { params: { program, catalogYear } });
      return data;
    },
    enabled: Boolean(program && catalogYear),
  });

  useEffect(() => {
    if (!data) return;
    const map: Record<string, { x: number; y: number }> = {};
    data.courses.forEach((c) => { map[c.boardKey] = { x: c.x, y: c.y }; });
    setHexPos(map);
  }, [data]);

  const savePos = useMutation({
    mutationFn: ({ courseKey, x, y }: { courseKey: string; x: number; y: number }) =>
      api.put('/gameboard/hex-position', { courseKey, x, y }),
  });

  const setStyle = useMutation({
    mutationFn: (p: { studentId: number; isSoftDropped: boolean; indicatorColor: string }) =>
      api.put('/gameboard/student/style', p),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gameboard'] }),
  });

  const move = useMutation({
    mutationFn: ({ studentId, courseName }: { studentId: number; courseName: string }) =>
      api.put('/gameboard/student/move', { studentId, courseName }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gameboard'] }),
  });

  // ── Zoom ─────────────────────────────────────────────────────────────────────
  const clamp = (z: number) => Math.max(0.4, Math.min(2.5, +z.toFixed(2)));
  function onWheel(e: React.WheelEvent) {
    if (!e.ctrlKey) return;
    e.preventDefault();
    setZoom((z) => clamp(z + (e.deltaY > 0 ? -0.1 : 0.1)));
  }

  // ── Hex drag (Ctrl + drag) ────────────────────────────────────────────────────
  function onHexPointerDown(e: React.PointerEvent, course: GBCourse) {
    if (!e.ctrlKey) return;
    e.preventDefault();
    e.stopPropagation();
    const pos = hexPos[course.boardKey] || { x: course.x, y: course.y };
    dragRef.current = { boardKey: course.boardKey, startMX: e.clientX, startMY: e.clientY, startX: pos.x, startY: pos.y };
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const dx = (e.clientX - dragRef.current.startMX) / zoom;
    const dy = (e.clientY - dragRef.current.startMY) / zoom;
    setHexPos((prev) => ({
      ...prev,
      [dragRef.current!.boardKey]: { x: dragRef.current!.startX + dx, y: dragRef.current!.startY + dy },
    }));
  }

  function onPointerUp() {
    if (!dragRef.current) return;
    const { boardKey } = dragRef.current;
    const pos = hexPos[boardKey];
    if (pos) savePos.mutate({ courseKey: boardKey, x: pos.x, y: pos.y });
    dragRef.current = null;
  }

  function onStudentCtx(e: React.MouseEvent, s: GBStudent, courseKey: string) {
    e.preventDefault();
    e.stopPropagation();
    setTooltip(null);
    setCtxMenu({ x: e.clientX, y: e.clientY, student: s, courseKey });
  }

  const courses = data?.courses || [];
  const selectedCourse = courses.find((c) => c.courseKey === selectedKey) || null;
  const filtered = selectedCourse
    ? selectedCourse.students.filter((s) =>
        !search || `${s.firstName} ${s.lastName}`.toLowerCase().includes(search.toLowerCase())
      )
    : [];

  const svgW = Math.max(1200, ...Object.values(hexPos).map((p) => p.x + R * 2 + 60));
  const svgH = Math.max(800, ...Object.values(hexPos).map((p) => p.y + HEX_H / 2 + R + 60));

  return (
    <div className="flex flex-col h-full overflow-hidden" onClick={() => setCtxMenu(null)}>

      {/* ── Toolbar ────────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-[#3E3E42] bg-[#252526] shrink-0">
        {/* Left — selectors */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-[#CCCCCC]">Program:</span>
          <select
            className="h-8 rounded border border-[#3E3E42] bg-[#1E1E1E] text-sm text-white px-2 focus:outline-none focus:ring-1 focus:ring-[#007ACC] w-48"
            value={program}
            onChange={(e) => setProgram(e.target.value)}
          >
            <option value="">— all programs —</option>
            {programs.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-[#CCCCCC]">Catalog Year:</span>
          <select
            className="h-8 rounded border border-[#3E3E42] bg-[#1E1E1E] text-sm text-white px-2 focus:outline-none focus:ring-1 focus:ring-[#007ACC] w-28"
            value={catalogYear}
            onChange={(e) => setCatalogYear(e.target.value)}
          >
            <option value="">— all —</option>
            {catalogYears.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Right — zoom + refresh */}
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setZoom((z) => clamp(z - 0.1))}
            className="h-8 w-8 rounded border border-[#3E3E42] bg-[#1E1E1E] text-white hover:bg-[#2D2D30] flex items-center justify-center text-base font-bold"
          >−</button>
          <span className="text-sm text-[#CCCCCC] w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom((z) => clamp(z + 0.1))}
            className="h-8 w-8 rounded border border-[#3E3E42] bg-[#1E1E1E] text-white hover:bg-[#2D2D30] flex items-center justify-center text-base font-bold"
          >+</button>
          <button
            onClick={() => setZoom(1)}
            className="h-8 px-3 rounded border border-[#3E3E42] bg-[#1E1E1E] text-sm text-white hover:bg-[#2D2D30] ml-1"
          >Reset</button>
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="h-8 px-4 rounded bg-[#007ACC] hover:bg-[#005fa3] text-white text-sm ml-2 flex items-center gap-1.5 disabled:opacity-60"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Canvas + right panel ─────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* SVG canvas */}
        <div className="flex-1 overflow-auto bg-[#1E1E1E] relative" onWheel={onWheel}>
          {!program || !catalogYear ? (
            <div className="flex items-center justify-center h-full text-[#666] text-sm">
              Select a Program and Catalog Year to load the gameboard
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center h-full text-[#666] text-sm">Loading…</div>
          ) : courses.length === 0 ? (
            <div className="flex items-center justify-center h-full text-[#666] text-sm">
              No students found for {program} / {catalogYear}
            </div>
          ) : (
            <div style={{ transform: `scale(${zoom})`, transformOrigin: '0 0', width: svgW, height: svgH }}>
              <svg ref={svgRef} width={svgW} height={svgH}
                onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
                {courses.map((course) => {
                  const pos = hexPos[course.boardKey] || { x: course.x, y: course.y };
                  const cx = pos.x, cy = pos.y;
                  const isSelected = selectedKey === course.courseKey;
                  const isUnassigned = course.courseKey === '__UNASSIGNED__';
                  const vis = course.students.slice(0, MAX_VISIBLE);
                  const overflow = course.students.length - MAX_VISIBLE;
                  const apos = avatarPositions(vis.length);

                  return (
                    <g key={course.boardKey}
                      style={{ cursor: 'pointer' }}
                      onPointerDown={(e) => onHexPointerDown(e, course)}
                      onClick={(e) => {
                        if (dragRef.current) return;
                        e.stopPropagation();
                        setSelectedKey((k) => k === course.courseKey ? null : course.courseKey);
                      }}
                      onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY, course })}
                      onMouseLeave={() => setTooltip(null)}
                      onMouseMove={(e) => setTooltip((t) => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                    >
                      {/* Hex */}
                      <polygon points={hexPoints(cx, cy)}
                        fill={isUnassigned ? '#3C3C41' : '#2D2D30'}
                        stroke={isSelected ? '#F7E36D' : '#007ACC'}
                        strokeWidth={isSelected ? 3 : 2} />

                      {/* Course name — wrapped at ~18 chars */}
                      {(() => {
                        const name = course.courseName;
                        const words = name.split(' ');
                        const lines: string[] = [];
                        let line = '';
                        for (const w of words) {
                          if ((line + ' ' + w).trim().length > 16 && line) { lines.push(line); line = w; }
                          else line = (line + ' ' + w).trim();
                        }
                        if (line) lines.push(line);
                        const topY = cy - HEX_H / 2 + 14;
                        return lines.slice(0, 2).map((l, i) => (
                          <text key={i} x={cx} y={topY + i * 13}
                            textAnchor="middle" fontSize="11" fontWeight="bold"
                            fill="#CCCCCC" style={{ pointerEvents: 'none' }}>{l}</text>
                        ));
                      })()}

                      {/* Count */}
                      <text x={cx} y={cy - HEX_H / 2 + 42}
                        textAnchor="middle" fontSize="9" fill="#888"
                        style={{ pointerEvents: 'none' }}>
                        {course.students.length} student{course.students.length !== 1 ? 's' : ''}
                      </text>

                      {/* Avatars */}
                      {vis.map((s, i) => {
                        const p = apos[i] || { x: 0, y: 0 };
                        const ax = cx + p.x, ay = cy + p.y + 10;
                        return s.isSoftDropped
                          ? <Diamond key={s.id} cx={ax} cy={ay} label={initials(s.firstName, s.lastName)} />
                          : (
                            <g key={s.id}
                              onContextMenu={(e) => onStudentCtx(e, s, course.courseKey)}
                              style={{ cursor: 'context-menu' }}>
                              <circle cx={ax} cy={ay} r={AVATAR_R}
                                fill={s.indicatorColor || '#0078CC'} stroke="#B4B4B4" strokeWidth="1" />
                              <text x={ax} y={ay + 4} textAnchor="middle" fontSize="9"
                                fontWeight="bold" fill="white" style={{ pointerEvents: 'none' }}>
                                {initials(s.firstName, s.lastName)}
                              </text>
                            </g>
                          );
                      })}

                      {/* +N overflow */}
                      {overflow > 0 && (
                        <g style={{ pointerEvents: 'none' }}>
                          <circle cx={cx + R * 0.45} cy={cy + HEX_H * 0.28} r={13}
                            fill="#444" stroke="#666" strokeWidth="1" />
                          <text x={cx + R * 0.45} y={cy + HEX_H * 0.28 + 4}
                            textAnchor="middle" fontSize="9" fill="white">+{overflow}</text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          )}

          {courses.length > 0 && (
            <div className="absolute bottom-3 left-3 text-[10px] text-[#444] pointer-events-none">
              Ctrl+drag hexagon to reposition · Right-click student for options · Ctrl+scroll to zoom
            </div>
          )}
        </div>

        {/* Right panel */}
        {selectedCourse && (
          <div className="w-64 shrink-0 border-l border-[#3E3E42] flex flex-col bg-[#252526] overflow-hidden">
            <div className="flex items-start justify-between px-4 py-3 border-b border-[#3E3E42]">
              <div>
                <p className="text-sm font-semibold text-white leading-tight">{selectedCourse.courseName}</p>
                <p className="text-xs text-[#999] mt-0.5">{selectedCourse.students.length} students</p>
              </div>
              <button onClick={() => setSelectedKey(null)} className="text-[#666] hover:text-white mt-0.5">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-3 py-2 border-b border-[#3E3E42]">
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-[#666]" />
                <Input placeholder="Search…" className="pl-8 h-7 text-xs bg-[#1E1E1E] border-[#3E3E42] text-white"
                  value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {filtered.map((s) => (
                <div key={s.id}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-[#2D2D30] border-b border-[#3E3E42] last:border-0 cursor-pointer"
                  title="Double-click to open student"
                  onDoubleClick={() => navigate(`/students/${s.id}`)}
                  onContextMenu={(e) => onStudentCtx(e, s, selectedCourse.courseKey)}>
                  <div className={cn(
                    'h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                    s.isSoftDropped ? 'bg-yellow-500 text-black' : 'bg-[#0078CC] text-white'
                  )}>
                    {initials(s.firstName, s.lastName)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-white truncate">{s.firstName} {s.lastName}</p>
                    {s.isSoftDropped && <p className="text-[10px] text-yellow-400">Soft Dropped</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tooltip */}
      {tooltip && !ctxMenu && (
        <div className="fixed z-40 bg-[#252526] border border-[#3E3E42] rounded shadow-lg px-3 py-2 text-xs pointer-events-none max-w-[220px]"
          style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}>
          <p className="font-semibold text-white mb-1">{tooltip.course.courseName}</p>
          <p className="text-[#888] mb-1">{tooltip.course.students.length} student{tooltip.course.students.length !== 1 ? 's' : ''}</p>
          {tooltip.course.students.slice(0, 10).map((s) => (
            <p key={s.id} className="text-[#ccc]">{s.firstName} {s.lastName}</p>
          ))}
          {tooltip.course.students.length > 10 && (
            <p className="text-[#777]">… and {tooltip.course.students.length - 10} more</p>
          )}
          <p className="text-[#555] mt-1">[Hold Ctrl + drag to move]</p>
        </div>
      )}

      {/* Context menu */}
      {ctxMenu && (
        <div className="fixed z-50 bg-[#252526] border border-[#3E3E42] rounded shadow-xl py-1 min-w-[190px]"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          onClick={(e) => e.stopPropagation()}>
          <div className="px-3 py-1.5 text-xs font-semibold text-[#999] border-b border-[#3E3E42] mb-1">
            {ctxMenu.student.firstName} {ctxMenu.student.lastName}
          </div>
          <button
            onClick={() => {
              setStyle.mutate({
                studentId: ctxMenu.student.id,
                isSoftDropped: !ctxMenu.student.isSoftDropped,
                indicatorColor: !ctxMenu.student.isSoftDropped ? '#F7E36D' : '#0078CC',
              });
              setCtxMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 text-sm text-[#CCCCCC] hover:bg-[#2D2D30] flex items-center gap-2">
            <span className="w-3 h-3 rounded-full inline-block shrink-0"
              style={{ background: ctxMenu.student.isSoftDropped ? '#0078CC' : '#F7E36D' }} />
            {ctxMenu.student.isSoftDropped ? 'Clear Soft Drop' : 'Soft Drop (Yellow Diamond)'}
          </button>
          <button
            onClick={() => { setMoveTarget({ student: ctxMenu.student }); setCtxMenu(null); }}
            className="w-full text-left px-3 py-1.5 text-sm text-[#CCCCCC] hover:bg-[#2D2D30]">
            Move to Course…
          </button>
        </div>
      )}

      {/* Move dialog */}
      {moveTarget && (
        <MoveDialog
          student={moveTarget.student}
          courses={courses}
          onMove={(courseName) => { move.mutate({ studentId: moveTarget.student.id, courseName }); setMoveTarget(null); }}
          onClose={() => setMoveTarget(null)}
        />
      )}
    </div>
  );
}
