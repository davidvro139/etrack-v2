import { renderHook } from '@testing-library/react';
import { useRole } from '@/hooks/useRole';
import { useAuthStore } from '@/store/auth';

function setRole(role: string) {
  useAuthStore.setState({ token: 'tok', user: { id: '1', name: 'U', email: 'u@u.com', role } });
}

describe('useRole', () => {
  test('canWrite is true for admin', () => {
    setRole('admin');
    const { result } = renderHook(() => useRole());
    expect(result.current.canWrite).toBe(true);
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.isObserver).toBe(false);
  });

  test('canWrite is true for instructor', () => {
    setRole('instructor');
    const { result } = renderHook(() => useRole());
    expect(result.current.canWrite).toBe(true);
    expect(result.current.isAdmin).toBe(false);
  });

  test('canWrite is false for observer', () => {
    setRole('observer');
    const { result } = renderHook(() => useRole());
    expect(result.current.canWrite).toBe(false);
    expect(result.current.isObserver).toBe(true);
  });
});
