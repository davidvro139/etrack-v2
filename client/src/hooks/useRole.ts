import { useAuthStore } from '@/store/auth';

export function useRole() {
  const user = useAuthStore((s) => s.user);
  const role = user?.role ?? 'observer';
  return {
    role,
    isAdmin: role === 'admin',
    isObserver: role === 'observer',
    canWrite: role !== 'observer',
  };
}
