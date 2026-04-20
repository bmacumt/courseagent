import { ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { AppLayout } from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import UserManagement from './pages/admin/UserManagement';
import ModelManagement from './pages/admin/ModelManagement';
import AdminKnowledge from './pages/admin/AdminKnowledge';
import AdminAssignments from './pages/admin/AdminAssignments';
import AdminSubmissions from './pages/admin/AdminSubmissions';
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
  const token = localStorage.getItem('tunnel_auth_token');
  if (!token) return <Navigate to="/login" replace />;
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
      { path: 'admin/models', element: <ModelManagement /> },
      { path: 'admin/knowledge', element: <AdminKnowledge /> },
      { path: 'admin/assignments', element: <AdminAssignments /> },
      { path: 'admin/submissions/:id', element: <AdminSubmissions /> },

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