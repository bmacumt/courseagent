import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, Users, Settings, Database, ClipboardList,
  FileText, MessageSquare, LogOut, ChevronLeft, ChevronRight, Menu, X,
} from 'lucide-react';

const adminNav = [
  { path: '/admin/dashboard', label: '系统概览', icon: LayoutDashboard },
  { path: '/admin/users', label: '用户管理', icon: Users },
  { path: '/admin/settings', label: '系统配置', icon: Settings },
];

const teacherNav = [
  { path: '/teacher/dashboard', label: '教学概览', icon: LayoutDashboard },
  { path: '/teacher/knowledge', label: '知识库管理', icon: Database },
  { path: '/teacher/assignments', label: '作业管理', icon: ClipboardList },
];

const studentNav = [
  { path: '/student/dashboard', label: '学习概览', icon: LayoutDashboard },
  { path: '/student/assignments', label: '我的作业', icon: ClipboardList },
  { path: '/student/submissions', label: '我的提交', icon: FileText },
  { path: '/student/qa', label: '知识问答', icon: MessageSquare },
];

const roleConfig = {
  admin: { label: '管理员', color: '#4A6FA5', bg: 'rgba(74,111,165,0.2)', nav: adminNav },
  teacher: { label: '教师', color: '#6B8F71', bg: 'rgba(107,143,113,0.2)', nav: teacherNav },
  student: { label: '学生', color: '#7A8F9E', bg: 'rgba(122,143,158,0.2)', nav: studentNav },
};

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const role = user?.role || 'student';
  const rc = roleConfig[role];
  const nav = rc.nav;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const SIDEBAR_W = collapsed ? 64 : 220;

  const SidebarContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo */}
      <div style={{
        height: 64, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 10,
        borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0,
      }}>
        <div style={{
          width: 36, height: 36, background: '#4A6FA5', borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <span style={{ color: 'white', fontSize: 15, fontWeight: 700 }}>隧</span>
        </div>
        {!collapsed && (
          <div style={{ overflow: 'hidden' }}>
            <div style={{ color: '#FFFFFF', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>隧道工程课程</div>
            <div style={{ color: '#A4B0BE', fontSize: 11, whiteSpace: 'nowrap' }}>智能体平台</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 8px', overflow: 'hidden auto' }}>
        {nav.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => setMobileOpen(false)}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: collapsed ? '10px' : '10px 12px',
              borderRadius: 7,
              marginBottom: 3,
              color: isActive ? '#FFFFFF' : '#A4B0BE',
              background: isActive ? 'rgba(74, 111, 165, 0.45)' : 'transparent',
              textDecoration: 'none',
              fontSize: 14,
              transition: 'all 0.15s',
              justifyContent: collapsed ? 'center' : 'flex-start',
            })}
          >
            <item.icon size={17} style={{ flexShrink: 0 }} />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Bottom: user info + collapse */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '10px 8px', flexShrink: 0 }}>
        {!collapsed && (
          <div style={{ padding: '8px 12px', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: rc.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: 13, fontWeight: 600, flexShrink: 0,
            }}>
              {(user?.real_name || user?.username || '').charAt(0)}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ color: '#FFFFFF', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.real_name || user?.username}
              </div>
              <span style={{ background: rc.bg, color: rc.color, borderRadius: 3, padding: '1px 6px', fontSize: 11 }}>
                {rc.label}
              </span>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
            color: '#A4B0BE', background: 'transparent', border: 'none', cursor: 'pointer',
            width: '100%', borderRadius: 7, fontSize: 13, justifyContent: collapsed ? 'center' : 'flex-start',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <LogOut size={16} />
          {!collapsed && <span>退出登录</span>}
        </button>
        {/* Collapse toggle (desktop only) */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8,
            color: '#A4B0BE', background: 'transparent', border: 'none', cursor: 'pointer',
            width: '100%', borderRadius: 7, transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </div>
  );

  return (
    <div style={{
      display: 'flex', height: '100vh',
      fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
      background: '#F7F8FA',
    }}>
      {/* Desktop Sidebar */}
      <div
        className="hidden md:block"
        style={{
          width: SIDEBAR_W, background: '#2C3A47',
          transition: 'width 0.22s ease', flexShrink: 0, zIndex: 50,
        }}
      >
        <SidebarContent />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex' }}
          onClick={() => setMobileOpen(false)}
        >
          <div
            style={{ width: 220, background: '#2C3A47', height: '100%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <SidebarContent />
          </div>
          <div style={{ flex: 1, background: 'rgba(0,0,0,0.4)' }} />
        </div>
      )}

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Top bar */}
        <div style={{
          height: 64, background: '#FFFFFF', borderBottom: '1px solid #E8ECF0',
          display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, flexShrink: 0,
        }}>
          {/* Mobile menu toggle */}
          <button
            className="flex md:hidden"
            onClick={() => setMobileOpen(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7F8C8D', padding: 4 }}
          >
            <Menu size={20} />
          </button>
          <div style={{ flex: 1 }} />
          {/* User info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, background: rc.color, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: 14, fontWeight: 600, flexShrink: 0,
            }}>
              {(user?.real_name || user?.username || '').charAt(0)}
            </div>
            <div className="hidden sm:block">
              <div style={{ fontSize: 14, fontWeight: 500, color: '#2C3E50' }}>{user?.real_name || user?.username}</div>
              <div style={{ fontSize: 12, color: '#7F8C8D' }}>{rc.label}</div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
