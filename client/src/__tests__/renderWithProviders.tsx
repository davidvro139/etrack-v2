import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';

export function setRole(role: 'admin' | 'instructor' | 'observer') {
  useAuthStore.setState({
    token: 'fake-token',
    user: {
      id: '1',
      name: 'Test User',
      email: 'test@test.com',
      role,
    },
  });
}

export function renderWithProviders(ui: React.ReactElement, { role = 'instructor' }: { role?: 'admin' | 'instructor' | 'observer' } = {}) {
  setRole(role);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  );
}
