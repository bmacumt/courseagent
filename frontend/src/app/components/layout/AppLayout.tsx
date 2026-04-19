import { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, Users, Cpu, Database, ClipboardList,
  FileText, MessageSquare, LogOut, ChevronLeft, ChevronRight, Menu,
  User, Mail, KeyRound, Loader2, X,
} from 'lucide-react';
import * as authApi from '../../api/auth';
import type { UserResponse } from '../../api/types';
import { Modal } from '../../components/shared/ConfirmDialog';

const adminNav = [
  { path: '/admin/dashboard', label: '系统概览', icon: LayoutDashboard },
  { path: '/admin/users', label: '用户管理', icon: Users },
  { path: '/admin/models', label: '模型管理', icon: Cpu },
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

const isValidEmail = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Profile dropdown
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [profileData, setProfileData] = useState<UserResponse | null>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 24 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const avatarBtnRef = useRef<HTMLButtonElement>(null);

  // Email change modal
  const [emailModal, setEmailModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailCountdown, setEmailCountdown] = useState(0);
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const role = user?.role || 'student';
  const rc = roleConfig[role];
  const nav = rc.nav;

  useEffect(() => {
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const openProfile = async () => {
    try {
      const data = await authApi.getProfile();
      setProfileData(data);
    } catch {
      setProfileData(null);
    }
  };

  const toggleDropdown = () => {
    if (!dropdownOpen && avatarBtnRef.current) {
      const rect = avatarBtnRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    }
    setDropdownOpen(prev => !prev);
    openProfile();
  };

  const openEmailModal = () => {
    setNewEmail('');
    setEmailCode('');
    setEmailError('');
    setEmailSuccess(false);
    setEmailCountdown(0);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setEmailModal(true);
  };

  const handleSendCode = async () => {
    if (!newEmail || !isValidEmail(newEmail)) { setEmailError('请输入正确的邮箱格式'); return; }
    setEmailSending(true);
    setEmailError('');
    try {
      await authApi.sendCode(newEmail, 'change_email');
      setEmailCountdown(60);
      countdownRef.current = setInterval(() => {
        setEmailCountdown(prev => {
          if (prev <= 1) { if (countdownRef.current) clearInterval(countdownRef.current); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      setEmailError(err.response?.data?.detail || '发送失败');
    } finally {
      setEmailSending(false);
    }
  };

  const handleSaveEmail = async () => {
    if (!newEmail || !isValidEmail(newEmail)) { setEmailError('请输入正确的邮箱'); return; }
    if (!emailCode) { setEmailError('请输入验证码'); return; }
    setEmailSaving(true);
    setEmailError('');
    try {
      const updated = await authApi.changeEmail(newEmail, emailCode);
      setProfileData(updated);
      setEmailSuccess(true);
      setTimeout(() => {
        setEmailModal(false);
        setEmailSuccess(false);
      }, 1000);
    } catch (err: any) {
      setEmailError(err.response?.data?.detail || '修改失败');
    } finally {
      setEmailSaving(false);
    }
  };

  const SIDEBAR_W = collapsed ? 64 : 220;

  const SidebarContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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

      <nav style={{ flex: 1, padding: '12px 8px', overflow: 'hidden auto' }}>
        {nav.map(item => (
          <NavLink
            key={item.path} to={item.path} onClick={() => setMobileOpen(false)}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10,
              padding: collapsed ? '10px' : '10px 12px', borderRadius: 7, marginBottom: 3,
              color: isActive ? '#FFFFFF' : '#A4B0BE',
              background: isActive ? 'rgba(74,111,165,0.45)' : 'transparent',
              textDecoration: 'none', fontSize: 14, transition: 'all 0.15s',
              justifyContent: collapsed ? 'center' : 'flex-start',
            })}
          >
            <item.icon size={17} style={{ flexShrink: 0 }} />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

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
              <span style={{ background: rc.bg, color: rc.color, borderRadius: 3, padding: '1px 6px', fontSize: 11 }}>{rc.label}</span>
            </div>
          </div>
        )}
        <button onClick={handleLogout}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
            color: '#A4B0BE', background: 'transparent', border: 'none', cursor: 'pointer',
            width: '100%', borderRadius: 7, fontSize: 13, justifyContent: collapsed ? 'center' : 'flex-start',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <LogOut size={16} />{!collapsed && <span>退出登录</span>}
        </button>
        <button onClick={() => setCollapsed(!collapsed)} className="hidden md:flex"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8,
            color: '#A4B0BE', background: 'transparent', border: 'none', cursor: 'pointer',
            width: '100%', borderRadius: 7,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </div>
  );

  const inputStyle = {
    width: '100%', height: 36, padding: '0 12px', border: '1px solid #DCDFE6',
    borderRadius: 6, fontSize: 13, color: '#2C3E50', outline: 'none', boxSizing: 'border-box' as const,
  };

  return (
    <div style={{
      display: 'flex', height: '100vh',
      fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
      background: '#F7F8FA',
    }}>
      <div className="hidden md:block" style={{ width: SIDEBAR_W, background: '#2C3A47', transition: 'width 0.22s ease', flexShrink: 0, zIndex: 50 }}>
        <SidebarContent />
      </div>

      {mobileOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex' }} onClick={() => setMobileOpen(false)}>
          <div style={{ width: 220, background: '#2C3A47', height: '100%' }} onClick={e => e.stopPropagation()}>
            <SidebarContent />
          </div>
          <div style={{ flex: 1, background: 'rgba(0,0,0,0.4)' }} />
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top bar */}
        <div style={{
          height: 64, background: '#FFFFFF', borderBottom: '1px solid #E8ECF0',
          display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, flexShrink: 0,
          position: 'relative', zIndex: 50,
        }}>
          <button className="flex md:hidden" onClick={() => setMobileOpen(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7F8C8D', padding: 4 }}>
            <Menu size={20} />
          </button>
          <div style={{ flex: 1 }} />

          {/* Avatar */}
          <div ref={dropdownRef}>
            <button
              ref={avatarBtnRef}
              onClick={toggleDropdown}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, background: 'none',
                border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 8,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F0F2F5')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{
                width: 34, height: 34, background: rc.color, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontSize: 14, fontWeight: 600, flexShrink: 0,
              }}>
                {(user?.real_name || user?.username || '').charAt(0)}
              </div>
              <div className="hidden sm:block" style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#2C3E50' }}>{user?.real_name || user?.username}</div>
                <div style={{ fontSize: 12, color: '#7F8C8D' }}>{rc.label}</div>
              </div>
            </button>
          </div>
        </div>

        {/* Page content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          <Outlet />
        </div>
      </div>

      {/* Fixed dropdown overlay */}
      {dropdownOpen && (
        <>
          <div onClick={() => setDropdownOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 999 }} />
          <div style={{
            position: 'fixed', top: dropdownPos.top, right: dropdownPos.right,
            width: 280, background: '#FFFFFF', borderRadius: 10,
            border: '1px solid #E8ECF0', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            overflow: 'hidden', zIndex: 1000,
          }}>
            <div style={{ padding: '16px 18px', borderBottom: '1px solid #F0F2F5' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{
                  width: 44, height: 44, background: rc.color, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: 18, fontWeight: 600,
                }}>
                  {(user?.real_name || user?.username || '').charAt(0)}
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#2C3E50' }}>{profileData?.real_name || user?.real_name || user?.username}</div>
                  <div style={{ fontSize: 12, color: '#7F8C8D' }}>
                    <span style={{ background: rc.bg, color: rc.color, borderRadius: 3, padding: '1px 6px' }}>{rc.label}</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#7F8C8D' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <User size={13} /><span>用户名：{profileData?.username || user?.username}</span>
                </div>
                {profileData?.student_id && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 13, textAlign: 'center', fontSize: 11 }}>学号</span>
                    <span>{profileData.student_id}</span>
                  </div>
                )}
                {profileData?.class_name && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 13, textAlign: 'center', fontSize: 11 }}>班级</span>
                    <span>{profileData.class_name}</span>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Mail size={13} /><span>邮箱：{profileData?.email || '未设置'}</span>
                </div>
              </div>
            </div>
            <div style={{ padding: '6px 8px' }}>
              <button onClick={() => { setDropdownOpen(false); openEmailModal(); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                  width: '100%', background: 'transparent', border: 'none', cursor: 'pointer',
                  borderRadius: 6, fontSize: 13, color: '#2C3E50',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F0F2F5')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <Mail size={15} color="#4A6FA5" /> 修改邮箱
              </button>
              <button onClick={() => { setDropdownOpen(false); handleLogout(); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                  width: '100%', background: 'transparent', border: 'none', cursor: 'pointer',
                  borderRadius: 6, fontSize: 13, color: '#C46B6B',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#FFF0F0')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <LogOut size={15} /> 退出登录
              </button>
            </div>
          </div>
        </>
      )}

      {/* Change Email Modal */}
      <Modal
        open={emailModal}
        title="修改邮箱"
        onClose={() => !emailSaving && setEmailModal(false)}
        width={460}
        footer={!emailSuccess ? (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setEmailModal(false)} disabled={emailSaving}
              style={{ padding: '8px 20px', border: '1px solid #E8ECF0', borderRadius: 6, background: '#FFFFFF', color: '#2C3E50', cursor: 'pointer', fontSize: 14 }}>
              取消
            </button>
            <button onClick={handleSaveEmail} disabled={emailSaving}
              style={{
                padding: '8px 20px', border: 'none', borderRadius: 6,
                background: emailSaving ? '#A4B0BE' : '#4A6FA5', color: '#FFFFFF',
                cursor: emailSaving ? 'not-allowed' : 'pointer', fontSize: 14,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
              {emailSaving && <Loader2 size={14} className="animate-spin" />}
              确认修改
            </button>
          </div>
        ) : undefined}
      >
        {emailSuccess ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#2C3E50', marginBottom: 8 }}>邮箱修改成功</div>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 12, padding: '10px 14px', background: '#F7F8FA', borderRadius: 6, fontSize: 13, color: '#7F8C8D' }}>
              当前邮箱：{profileData?.email || '未设置'}
            </div>
            {emailError && (
              <div style={{ background: '#FFEAEA', border: '1px solid #FFCCCC', borderRadius: 6, padding: '8px 12px', fontSize: 13, color: '#C46B6B', marginBottom: 12 }}>
                {emailError}
              </div>
            )}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#2C3E50', marginBottom: 6 }}>新邮箱</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="请输入新邮箱"
                  style={{ ...inputStyle, flex: 1 }} />
                <button onClick={handleSendCode} disabled={emailSending || emailCountdown > 0}
                  style={{
                    padding: '0 14px', height: 36, border: '1px solid #D0D5DD', borderRadius: 6,
                    background: emailCountdown > 0 ? '#F0F2F5' : '#FFFFFF', color: emailCountdown > 0 ? '#A4B0BE' : '#4A6FA5',
                    cursor: emailCountdown > 0 ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 500,
                    whiteSpace: 'nowrap', flexShrink: 0,
                  }}>
                  {emailSending ? '发送中...' : emailCountdown > 0 ? `${emailCountdown}s` : '发送验证码'}
                </button>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#2C3E50', marginBottom: 6 }}>
                <KeyRound size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />验证码
              </label>
              <input value={emailCode} onChange={e => setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6位数字验证码" maxLength={6} style={inputStyle} />
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
