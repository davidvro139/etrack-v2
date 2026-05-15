import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export function useLastImport() {
  return useQuery({
    queryKey: ['lastNorthstarImport'],
    queryFn: async () => {
      const { data } = await api.get('/import/last');
      return data.lastImport as string | null;
    },
    staleTime: 60_000,
  });
}

export function importIsOverdue(lastImport: string | null | undefined): boolean {
  if (!lastImport) return true;
  return Date.now() - new Date(lastImport).getTime() > 7 * 24 * 60 * 60 * 1000;
}

export function importAgeLabel(lastImport: string | null | undefined): string {
  if (!lastImport) return 'Never imported';
  const days = Math.floor((Date.now() - new Date(lastImport).getTime()) / (24 * 60 * 60 * 1000));
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}
