import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock react-router-dom navigation
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ id: '1' }),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
    NavLink: ({ children, to, className }: any) => {
      const cls = typeof className === 'function' ? className({ isActive: false }) : className;
      return <a href={to} className={cls}>{children}</a>;
    },
  };
});

// Mock api module
vi.mock('@/lib/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
  },
}));
