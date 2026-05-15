import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export interface FollowUp {
  id: number;
  studentId: number;
  studentName: string;
  studentSisId: string;
  note: string;
  dueDate: string;
  completedAt: string | null;
  createdByName: string;
}

export function useFollowUps(studentId?: number, includeCompleted = false) {
  return useQuery<FollowUp[]>({
    queryKey: ['followups', studentId ?? 'all', includeCompleted],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (studentId) params.studentId = String(studentId);
      if (includeCompleted) params.includeCompleted = 'true';
      const { data } = await api.get('/followups', { params });
      return data;
    },
    staleTime: 30_000,
  });
}

export function countOverdue(followups: FollowUp[]): number {
  const now = Date.now();
  return followups.filter((f) => !f.completedAt && new Date(f.dueDate).getTime() < now).length;
}
