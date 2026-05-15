import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Badge } from '@/components/ui/badge';

function ProgressBar({ value }: { value: number }) {
  const color = value >= 80 ? 'bg-green-500' : value >= 50 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${value}%` }} />
    </div>
  );
}

export default function ProgressTab({ studentId }: { studentId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['progress', studentId],
    queryFn: async () => {
      const { data } = await api.get(`/students/${studentId}/progress`);
      return data;
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground mt-4">Loading…</p>;

  const { progress = [], engagement = [] } = data || {};

  if (progress.length === 0)
    return (
      <p className="text-sm text-muted-foreground py-8 text-center mt-4">
        No progress data. Run a Canvas sync to populate.
      </p>
    );

  return (
    <div className="mt-4 space-y-3">
      {progress.map((p: any) => {
        const eng = engagement.find((e: any) => e.courseId === p.courseId);
        return (
          <div key={p._id} className="rounded-lg border border-border p-4 bg-card">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-sm">{p.courseName || p.courseId}</span>
              <Badge variant={p.progressPercent >= 80 ? 'success' : p.progressPercent >= 50 ? 'warning' : 'destructive'}>
                {p.progressPercent}%
              </Badge>
            </div>
            <ProgressBar value={p.progressPercent} />
            <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
              <span>{p.completedModules} / {p.totalModules} modules</span>
              {p.dueDate && <span>Due: {new Date(p.dueDate).toLocaleDateString()}</span>}
              {eng && <span>· {eng.pageViews} page views</span>}
              {eng?.lastActive && <span>· Last active: {new Date(eng.lastActive).toLocaleDateString()}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
