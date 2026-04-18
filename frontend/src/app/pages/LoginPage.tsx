import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('请输入用户名和密码');
      return;
    }
    setLoading(true);
    setError('');
    const result = await login(username, password);
    setLoading(false);
    if (result.success) {
      const storedStr = localStorage.getItem('tunnel_auth_user');
      if (storedStr) {
        const user = JSON.parse(storedStr);
        if (user.role === 'admin') navigate('/admin/dashboard');
        else if (user.role === 'teacher') navigate('/teacher/dashboard');
        else navigate('/student/dashboard');
      }
    } else {
      setError(result.error || '登录失败');
    }
  };

  const quickLogin = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
    }}>
      {/* Left decorative panel */}
      <div style={{
        flex: 1,
        background: 'linear-gradient(135deg, #2C3A47 0%, #1a2634 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 48,
        position: 'relative',
        overflow: 'hidden',
      }}
        className="hidden lg:flex"
      >
        {/* Decorative circles */}
        <div style={{ position: 'absolute', top: -80, right: -80, width: 300, height: 300, borderRadius: '50%', background: 'rgba(74,111,165,0.15)' }} />
        <div style={{ position: 'absolute', bottom: -100, left: -60, width: 400, height: 400, borderRadius: '50%', background: 'rgba(74,111,165,0.08)' }} />

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 400 }}>
          <div style={{
            width: 72, height: 72, background: '#4A6FA5', borderRadius: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px', boxShadow: '0 8px 32px rgba(74,111,165,0.4)',
          }}>
            <span style={{ color: 'white', fontSize: 32, fontWeight: 700 }}>隧</span>
          </div>
          <h1 style={{ color: '#FFFFFF', fontSize: 28, fontWeight: 700, marginBottom: 12 }}>隧道工程课程智能体</h1>
          <p style={{ color: '#A4B0BE', fontSize: 15, lineHeight: 1.8 }}>
            基于 RAG + LLM 技术的 AI 辅助教学平台<br />
            智能评分 · 规范引用验证 · 知识问答
          </p>
        </div>
      </div>

      {/* Right login form */}
      <div style={{
        width: '100%', maxWidth: 480,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 40, background: '#FFFFFF',
      }}>
        <div style={{ width: '100%', maxWidth: 360 }}>
          {/* Mobile logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 36 }}>
            <div style={{ width: 44, height: 44, background: '#4A6FA5', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'white', fontSize: 20, fontWeight: 700 }}>隧</span>
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#2C3E50' }}>隧道工程课程智能体</div>
              <div style={{ fontSize: 12, color: '#7F8C8D' }}>AI 辅助教学平台</div>
            </div>
          </div>

          <h2 style={{ fontSize: 24, fontWeight: 600, color: '#2C3E50', marginBottom: 8 }}>欢迎登录</h2>
          <p style={{ fontSize: 14, color: '#7F8C8D', marginBottom: 32 }}>使用您的账号密码登录系统</p>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#2C3E50', marginBottom: 6 }}>用户名</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onFocus={() => setFocusedField('username')}
                onBlur={() => setFocusedField(null)}
                placeholder="请输入用户名"
                style={{
                  width: '100%', height: 40, padding: '0 14px',
                  border: `1px solid ${focusedField === 'username' ? '#4A6FA5' : '#DCDFE6'}`,
                  borderRadius: 6, fontSize: 14, color: '#2C3E50',
                  outline: 'none', boxSizing: 'border-box',
                  boxShadow: focusedField === 'username' ? '0 0 0 3px rgba(74,111,165,0.12)' : 'none',
                  transition: 'all 0.2s',
                }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#2C3E50', marginBottom: 6 }}>密码</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="请输入密码"
                  style={{
                    width: '100%', height: 40, padding: '0 40px 0 14px',
                    border: `1px solid ${focusedField === 'password' ? '#4A6FA5' : '#DCDFE6'}`,
                    borderRadius: 6, fontSize: 14, color: '#2C3E50',
                    outline: 'none', boxSizing: 'border-box',
                    boxShadow: focusedField === 'password' ? '0 0 0 3px rgba(74,111,165,0.12)' : 'none',
                    transition: 'all 0.2s',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: '#A4B0BE', padding: 0,
                  }}
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{
                background: '#FFEAEA', border: '1px solid #FFCCCC', borderRadius: 6,
                padding: '10px 14px', fontSize: 13, color: '#C46B6B', marginBottom: 16,
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', height: 42, background: loading ? '#A4B0BE' : '#4A6FA5',
                color: '#FFFFFF', border: 'none', borderRadius: 6,
                fontSize: 15, fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'background 0.2s',
              }}
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              登录
            </button>
          </form>

          {/* Quick login hints */}
          <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid #E8ECF0' }}>
            <div style={{ fontSize: 12, color: '#A4B0BE', marginBottom: 12, textAlign: 'center' }}>演示账号（点击快速填入）</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { label: '管理员', user: 'admin', pass: 'admin123', color: '#4A6FA5', bg: '#EBF3FF' },
                { label: '教师', user: 'teacher1', pass: 'teacher123', color: '#6B8F71', bg: '#EDFAF2' },
                { label: '学生', user: 'student1', pass: 'student123', color: '#7A8F9E', bg: '#F0F2F5' },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => quickLogin(item.user, item.pass)}
                  style={{
                    flex: 1, padding: '8px 0', background: item.bg,
                    color: item.color, border: 'none', borderRadius: 6,
                    fontSize: 12, fontWeight: 500, cursor: 'pointer',
                    transition: 'opacity 0.2s',
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}