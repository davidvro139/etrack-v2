import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { RefreshCw, AlertCircle, CheckCircle2, XCircle, ExternalLink, ClipboardList } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface Answer {
  courseDeadline: string;
  onTrack: string;
  daysAttended: string;
  learned: string;
  challenge: string;
  anyQuestions: string;
}

interface Reflection {
  submissionId: string;
  courseId: string;
  courseName: string;
  studentName: string;
  canvasUserId: string;
  assignmentId: string;
  assignmentName: string;
  submittedAt: string;
  quizId: string | null;
  attempt: number;
  answers: Answer;
  questions: { id: number; text: string }[];
}

function OnTrackBadge({ text }: { text: string }) {
  const lower = text?.toLowerCase() || '';
  if (lower.includes('yes') || lower === 'true')
    return <Badge variant="success">Yes</Badge>;
  if (lower.includes('no') || lower === 'false')
    return <Badge variant="destructive">No</Badge>;
  return <Badge variant="outline">{text || '—'}</Badge>;
}

function AnswerRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

export default function ReflectionsPage() {
  const { user } = useAuthStore();
  const [selected, setSelected] = useState<Reflection | null>(null);
  const [comment, setComment] = useState('');
  const [search, setSearch] = useState('');
  const [graded, setGraded] = useState<Set<string>>(new Set());
  const [justGraded, setJustGraded] = useState<{ id: string; pass: boolean } | null>(null);

  const { data: reflections = [], isLoading, error, refetch, isFetching } = useQuery<Reflection[]>({
    queryKey: ['canvas-reflections'],
    queryFn: async () => {
      const { data } = await api.get('/canvas/reflections');
      return data;
    },
    retry: false,
    enabled: Boolean(user?.canvasToken && user?.canvasSiteUrl),
  });

  const gradeMutation = useMutation({
    mutationFn: ({ pass }: { pass: boolean }) => {
      if (!selected) throw new Error('No reflection selected');
      const questionIds = selected.questions.map((q) => q.id);
      return api.post('/grade/reflection', {
        courseId: selected.courseId,
        quizId: selected.quizId,
        submissionId: selected.submissionId,
        attempt: selected.attempt,
        questionIds,
        pass,
        comment,
        reflection: selected,
      });
    },
    onSuccess: (_, { pass }) => {
      if (!selected) return;
      setJustGraded({ id: selected.submissionId, pass });
      setGraded((prev) => new Set([...prev, selected.submissionId]));
      setTimeout(() => {
        setSelected(null);
        setComment('');
        setJustGraded(null);
      }, 1500);
    },
  });

  const visible = reflections.filter(
    (r) =>
      !graded.has(r.submissionId) &&
      (search ? r.studentName?.toLowerCase().includes(search.toLowerCase()) ||
                 r.courseName?.toLowerCase().includes(search.toLowerCase()) : true)
  );

  const canvasConfigured = user?.canvasToken && user?.canvasSiteUrl;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div>
          <h1 className="text-xl font-semibold">Reflection Grader</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {visible.length} pending · canvas submissions where assignment contains "Reflection"
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching || !canvasConfigured}
        >
          <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
          Reload
        </Button>
      </div>

      {!canvasConfigured ? (
        <div className="flex items-start gap-3 m-6 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-destructive">Canvas not configured</p>
            <p className="text-muted-foreground mt-0.5">Add your Canvas token and site URL in Settings.</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-start gap-3 m-6 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-destructive">Failed to load reflections</p>
            <p className="text-muted-foreground mt-0.5">
              {(error as any)?.response?.data?.message || 'Check your Canvas token and site URL.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Left panel — submission list */}
          <div className="w-72 shrink-0 border-r border-border flex flex-col overflow-hidden">
            <div className="p-3 border-b border-border">
              <Input
                placeholder="Search student or course…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <p className="text-sm text-muted-foreground p-4">Loading…</p>
              ) : visible.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6">
                  <ClipboardList className="h-8 w-8 mb-2 opacity-40" />
                  <p className="text-sm text-center">No pending reflections</p>
                </div>
              ) : (
                visible.map((r) => (
                  <button
                    key={r.submissionId}
                    onClick={() => { setSelected(r); setComment(''); }}
                    className={cn(
                      'w-full text-left px-4 py-3 border-b border-border hover:bg-accent/50 transition-colors',
                      selected?.submissionId === r.submissionId && 'bg-accent'
                    )}
                  >
                    <p className="text-sm font-medium truncate">{r.studentName}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{r.assignmentName}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.courseName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : ''}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right panel — detail + grade controls */}
          <div className="flex-1 overflow-y-auto">
            {!selected ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <ClipboardList className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">Select a submission to grade</p>
              </div>
            ) : (
              <div className="p-6 max-w-2xl">
                {/* Student / Assignment header */}
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-semibold">{selected.studentName}</h2>
                    <p className="text-sm text-muted-foreground">{selected.assignmentName} · {selected.courseName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Submitted: {selected.submittedAt ? new Date(selected.submittedAt).toLocaleString() : '—'}
                      {' · '}Attempt {selected.attempt}
                    </p>
                  </div>
                  {user?.canvasSiteUrl && (
                    <a
                      href={`${user.canvasSiteUrl?.replace(/\/$/, '')}/courses/${selected.courseId}/gradebook/speed_grader?assignment_id=${selected.assignmentId}&student_id=${selected.canvasUserId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Speed Grader
                    </a>
                  )}
                </div>

                {/* Answers */}
                <div className="space-y-4 rounded-lg border border-border bg-card p-5 mb-6">
                  {selected.answers.courseDeadline && (
                    <AnswerRow label="Course Deadline" value={selected.answers.courseDeadline} />
                  )}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">On Track?</p>
                    <OnTrackBadge text={selected.answers.onTrack} />
                  </div>
                  {selected.answers.daysAttended && (
                    <AnswerRow label="Days Attended" value={selected.answers.daysAttended} />
                  )}
                  {selected.answers.learned && (
                    <AnswerRow label="What did you learn?" value={selected.answers.learned} />
                  )}
                  {selected.answers.challenge && (
                    <AnswerRow label="Biggest challenge" value={selected.answers.challenge} />
                  )}
                  {selected.answers.anyQuestions && (
                    <AnswerRow label="Any questions?" value={selected.answers.anyQuestions} />
                  )}
                </div>

                {/* Grade controls */}
                {!selected.quizId ? (
                  <div className="rounded-lg border border-yellow-600/40 bg-yellow-600/10 p-4 text-sm text-yellow-400">
                    No quiz ID found in this submission — cannot grade via API. Use Speed Grader instead.
                  </div>
                ) : justGraded?.id === selected.submissionId ? (
                  <div className={cn(
                    'flex items-center gap-2 rounded-lg p-4 text-sm font-medium',
                    justGraded.pass
                      ? 'bg-green-700/20 text-green-400 border border-green-700/40'
                      : 'bg-red-700/20 text-red-400 border border-red-700/40'
                  )}>
                    {justGraded.pass
                      ? <><CheckCircle2 className="h-4 w-4" /> Graded: Pass</>
                      : <><XCircle className="h-4 w-4" /> Graded: Fail</>
                    }
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">
                        Instructor comment (optional)
                      </p>
                      <Textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Feedback for student…"
                        rows={2}
                      />
                    </div>
                    <div className="flex gap-3">
                      <Button
                        className="flex-1 bg-green-700 hover:bg-green-600 text-white"
                        onClick={() => gradeMutation.mutate({ pass: true })}
                        disabled={gradeMutation.isPending}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Pass ({selected.questions.length * 6} pts)
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1"
                        onClick={() => gradeMutation.mutate({ pass: false })}
                        disabled={gradeMutation.isPending}
                      >
                        <XCircle className="h-4 w-4" />
                        Fail (0 pts)
                      </Button>
                    </div>
                    {gradeMutation.isError && (
                      <p className="text-sm text-destructive">
                        {(gradeMutation.error as any)?.response?.data?.message || 'Grading failed'}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
