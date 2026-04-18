import { ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { AppLayout } from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import UserManagement from './pages/admin/UserManagement';
import SystemSettings from './pages/admin/SystemSettings';
import TeacherDashboard from './pages/teacher/TeacherDashboard';
import KnowledgeBase from './pages/teacher/KnowledgeBase';
import Assignments from './pages/teacher/Assignments';
import Submissions from './pages/teacher/Submissions';
import TeacherReport from './pages/teacher/Report';
import StudentDashboard from './pages/student/StudentDashboard';
import AssignmentList from './pages/student/AssignmentList';
import SubmitAnswer from './pages/student/SubmitAnswer';
import MySubmissions from './pages/student/MySubmissions';
import StudentReport from './pages/student/StudentReport';
import QA from './pages/student/QA';

function RequireAuth({ children }: { children: ReactNode }) {
  const stored = localStorage.getItem('tunnel_auth_user');
  if (!stored) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <RequireAuth><AppLayout /></RequireAuth>,
    children: [
      { index: true, element: <Navigate to="/login" replace /> },

      // Admin routes
      { path: 'admin/dashboard', element: <AdminDashboard /> },
      { path: 'admin/users', element: <UserManagement /> },
      { path: 'admin/settings', element: <SystemSettings /> },

      // Teacher routes
      { path: 'teacher/dashboard', element: <TeacherDashboard /> },
      { path: 'teacher/knowledge', element: <KnowledgeBase /> },
      { path: 'teacher/assignments', element: <Assignments /> },
      { path: 'teacher/assignments/:id/submissions', element: <Submissions /> },
      { path: 'teacher/reports/:id', element: <TeacherReport /> },

      // Student routes
      { path: 'student/dashboard', element: <StudentDashboard /> },
      { path: 'student/assignments', element: <AssignmentList /> },
      { path: 'student/assignments/:id/submit', element: <SubmitAnswer /> },
      { path: 'student/submissions', element: <MySubmissions /> },
      { path: 'student/reports/:id', element: <StudentReport /> },
      { path: 'student/qa', element: <QA /> },
    ],
  },
]);