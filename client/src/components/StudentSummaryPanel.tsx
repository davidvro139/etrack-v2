import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { X, Copy, Check, ExternalLink, Plus, Bell } from 'lucide-react';
import { useState } from 'react';
import api from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useFollowUps } from '@/hooks/useFollowUps';
import { useRole } from '@/hooks/useRole';

interface Props {
  studentId: number;
  onClose: () => void;
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-[#CCCCCC]">{label}</span>
      <span className="text-sm text-white">{value || '—'}</span>
    </div>
  );
}

function CountLink({
  label,
  count,
  onClick,
}: {
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-[#CCCCCC]">{label}</span>
      <button
        onClick={onClick}
        className="text-sm font-bold underline text-sky-400 hover:text-sky-300 cursor-pointer transition-colors"
      >
        {count}
      </button>
    </div>
  );
}

export default function StudentSummaryPanel({ studentId, onClose }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { canWrite } = useRole();
  const [copied, setCopied] = useState(false);
  const [addingFollowUp, setAddingFollowUp] = useState(false);
  const [fuNote, setFuNote] = useState('');
  const [fuDate, setFuDate] = useState('');

  const { data: followUps = [] } = useFollowUps(studentId);
  const pendingFollowUps = followUps.filter((f) => !f.completedAt);

  const addFollowUp = useMutation({
    mutationFn: () => api.post('/followups', { studentId, note: fuNote, dueDate: fuDate }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['followups'] });
      setAddingFollowUp(false);
      setFuNote('');
      setFuDate('');
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['student-summary', studentId],
    queryFn: async () => {
      const { data } = await api.get(`/students/${studentId}/summary`);
      return data;
    },
    staleTime: 10_000,
  });

  function copyId() {
    navigator.clipboard.writeText(String(studentId));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function openTab(tab: string) {
    navigate(`/students/${studentId}?tab=${tab}`);
  }

  const s = data?.student;
  const progress = data?.progress;

  const onTrackLabel = (() => {
    if (!progress) return 'N/A';
    const pct = progress.progressPercent ?? 0;
    if (pct >= 80) return `On track (${progress.completedModules}/${progress.totalModules})`;
    if (pct >= 50) return `Slightly behind (${progress.completedModules}/${progress.totalModules})`;
    return `Behind (${progress.completedModules}/${progress.totalModules})`;
  })();

  const onTrackColor =
    !progress
      ? 'text-muted-foreground'
      : (progress.progressPercent ?? 0) >= 80
      ? 'text-green-400'
      : (progress.progressPercent ?? 0) >= 50
      ? 'text-yellow-400'
      : 'text-red-400';

  return (
    <div
      className="w-[280px] shrink-0 border-l border-[#444] flex flex-col"
      style={{ background: '#222' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#444]">
        <span className="text-base font-bold text-white">Student Summary</span>
        <button
          onClick={onClose}
          className="text-[#CCCCCC] hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {isLoading ? (
        <div className="p-4 text-sm text-[#CCCCCC]">Loading…</div>
      ) : !s ? (
        <div className="p-4 text-sm text-[#CCCCCC]">Not found.</div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Name */}
          <Field label="Name" value={s.fullName} />

          {/* Student ID with copy button */}
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-[#CCCCCC]">Student ID</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-white">{s.sisId || studentId}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(String(s.sisId || studentId));
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                title="Copy Student ID"
                className={cn(
                  'flex items-center justify-center h-[18px] w-[18px] rounded transition-opacity',
                  'bg-[#2D2D2D] border border-[#3A3A3A] hover:opacity-100 opacity-90'
                )}
              >
                {copied
                  ? <Check className="h-3 w-3 text-green-400" />
                  : <Copy className="h-3 w-3 text-[#AAAAAA]" />
                }
              </button>
            </div>
          </div>

          {/* Course */}
          <Field label="Course" value={s.enrollment?.currentCourse || '(unknown)'} />

          {/* Deadline */}
          <Field
            label="Deadline"
            value={
              s.enrollment?.courseStopDate
                ? new Date(s.enrollment.courseStopDate).toLocaleDateString()
                : s.enrollment?.gradDate
                ? new Date(s.enrollment.gradDate).toLocaleDateString()
                : '(none)'
            }
          />

          {/* On Track */}
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-[#CCCCCC]">On Track</span>
            <span className={cn('text-sm font-medium', onTrackColor)}>{onTrackLabel}</span>
          </div>

          {/* Separator */}
          <div className="border-t border-[#444]" />

          {/* Counts */}
          <CountLink
            label="Interactions"
            count={data?.interactionCount ?? 0}
            onClick={() => openTab('interactions')}
          />
          <CountLink
            label="Outcomes"
            count={data?.outcomeCount ?? 0}
            onClick={() => openTab('outcomes')}
          />
          <CountLink
            label="Contacts"
            count={data?.contactCount ?? 0}
            onClick={() => openTab('contacts')}
          />

          {/* Follow-ups */}
          <div className="border-t border-[#444] pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#CCCCCC] flex items-center gap-1">
                <Bell className="h-3 w-3" />
                Follow-ups {pendingFollowUps.length > 0 && `(${pendingFollowUps.length})`}
              </span>
              {canWrite && (
                <button
                  onClick={() => setAddingFollowUp((v) => !v)}
                  className="text-sky-400 hover:text-sky-300 transition-colors"
                  title="Add follow-up"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {pendingFollowUps.slice(0, 3).map((f) => (
              <div key={f.id} className="text-xs text-[#CCCCCC] border border-[#444] rounded p-2">
                <span className={cn(
                  new Date(f.dueDate).getTime() < Date.now() ? 'text-red-400' : 'text-yellow-400'
                )}>
                  {new Date(f.dueDate).toLocaleDateString()}
                </span>
                {f.note && <p className="mt-0.5 truncate">{f.note}</p>}
              </div>
            ))}

            {addingFollowUp && (
              <div className="space-y-1.5">
                <input
                  type="date"
                  value={fuDate}
                  onChange={(e) => setFuDate(e.target.value)}
                  className="w-full text-xs bg-[#2D2D2D] border border-[#444] rounded px-2 py-1 text-white"
                />
                <input
                  type="text"
                  value={fuNote}
                  onChange={(e) => setFuNote(e.target.value)}
                  placeholder="Note (optional)"
                  className="w-full text-xs bg-[#2D2D2D] border border-[#444] rounded px-2 py-1 text-white placeholder:text-[#888]"
                />
                <div className="flex gap-1.5">
                  <button
                    onClick={() => addFollowUp.mutate()}
                    disabled={!fuDate || addFollowUp.isPending}
                    className="flex-1 text-xs bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded px-2 py-1 transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => { setAddingFollowUp(false); setFuNote(''); setFuDate(''); }}
                    className="text-xs text-[#CCCCCC] hover:text-white px-2 py-1 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Open full detail */}
          <div className="pt-2 border-t border-[#444]">
            <button
              onClick={() => navigate(`/students/${studentId}`)}
              className="flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open full details
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
