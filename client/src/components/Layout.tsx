import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Users, BarChart2, Settings, LogOut, GraduationCap, ClipboardList, Mail, FileSpreadsheet, Grid3x3, UserX, ListChecks, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';
import { useLastImport, importIsOverdue } from '@/hooks/useLastImport';
import { useFollowUps, countOverdue } from '@/hooks/useFollowUps';

const nav = [
  { to: '/students', label: 'Students', icon: Users },
  { to: '/on-track', label: 'On-Track Report', icon: BarChart2 },
  { to: '/inactive-report', label: 'Inactive Report', icon: UserX },
  { to: '/tasks', label: 'Follow-ups', icon: ListChecks },
  { to: '/reflections', label: 'Reflection Grader', icon: ClipboardList },
  { to: '/email', label: 'Email Students', icon: Mail },
  { to: '/gameboard', label: 'Gameboard', icon: Grid3x3 },
  { to: '/import', label: 'Northstar Import', icon: FileSpreadsheet },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { data: lastImport } = useLastImport();
  const importOverdue = importIsOverdue(lastImport);
  const { data: followups = [] } = useFollowUps();
  const overdueTaskCount = countOverdue(followups);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 flex flex-col border-r border-border bg-card">
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 h-14 border-b border-border">
          <GraduationCap className="h-5 w-5 text-primary" />
          <span className="font-semibold tracking-wide text-foreground">ETrack</span>
          <span className="ml-auto text-xs text-muted-foreground">2.0</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {user?.role === 'admin' && (
            <NavLink
              to="/admin/users"
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-accent text-foreground font-medium'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )
              }
            >
              <ShieldCheck className="h-4 w-4" />
              Users
              <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/20 text-primary leading-none shrink-0">
                Admin
              </span>
            </NavLink>
          )}
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-accent text-foreground font-medium'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
              {to === '/import' && user?.role === 'observer' && (
                <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground leading-none shrink-0">
                  Read-only
                </span>
              )}
              {to === '/import' && user?.role !== 'observer' && importOverdue && (
                <span className="ml-auto h-2 w-2 rounded-full bg-amber-500 shrink-0" title="Northstar import overdue" />
              )}
              {to === '/tasks' && overdueTaskCount > 0 && (
                <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground leading-none shrink-0">
                  {overdueTaskCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User / Logout */}
        <div className="p-3 border-t border-border">
          <div className="text-xs text-muted-foreground truncate mb-2 px-1">{user?.name}</div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
