import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import Layout from '@/components/Layout';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import StudentsPage from '@/pages/StudentsPage';
import StudentDetailPage from '@/pages/StudentDetailPage';
import OnTrackPage from '@/pages/OnTrackPage';
import InactiveReportPage from '@/pages/InactiveReportPage';
import ReflectionsPage from '@/pages/ReflectionsPage';
import EmailPage from '@/pages/EmailPage';
import ImportPage from '@/pages/ImportPage';
import GameboardPage from '@/pages/GameboardPage';
import SettingsPage from '@/pages/SettingsPage';
import TaskListPage from '@/pages/TaskListPage';
import AdminUsersPage from '@/pages/AdminUsersPage';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/students" replace />} />
        <Route path="students" element={<StudentsPage />} />
        <Route path="students/:id" element={<StudentDetailPage />} />
        <Route path="on-track" element={<OnTrackPage />} />
        <Route path="inactive-report" element={<InactiveReportPage />} />
        <Route path="reflections" element={<ReflectionsPage />} />
        <Route path="email" element={<EmailPage />} />
        <Route path="gameboard" element={<GameboardPage />} />
        <Route path="import" element={<ImportPage />} />
        <Route path="tasks" element={<TaskListPage />} />
        <Route path="admin/users" element={<AdminUsersPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
