import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, Loader2, Mail, KeyRound } from 'lucide-react';
import * as authApi from '../api/auth';

function isValidPassword(pwd: string): boolean {
  return pwd.length >= 6 && /[A-Za-z]/.test(pwd) && /\d/.test(pwd);
}

function isValidEmail(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

type PageMode = 'login' | 'register' | 'forgot_password';

export default function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<PageMode>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [code, setCode] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Verification code state
  const [codeSent, setCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, []);

  const redirectByRole = () => {
    const storedStr = localStorage.getItem('tunnel_auth_user');
    if (storedStr) {
      const user = JSON.parse(storedStr);
      if (user.role === 'admin') navigate('/admin/dashboard');
      else if (user.role === 'teacher') navigate('/teacher/dashboard');
      else navigate('/student/dashboard');
    }
  };

  const startCountdown = () => {
    setCountdown(60);
    setCodeSent(true);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendCode = async () => {
    if (!email) { setError('请输入邮箱'); return; }
    if (!isValidEmail(email)) { setError('请输入正确的邮箱格式'); return; }

    if (mode === 'register' && !username) { setError('请先输入用户名'); return; }

    setSendingCode(true);
    setError('');
    try {
      const purpose = mode === 'forgot_password' ? 'reset_password' : 'register';
      const res = await authApi.sendCode(email, purpose);
      startCountdown();
    } catch (err: any) {
      setError(err.response?.data?.detail || '发送验证码失败');
    } finally {
      setSendingCode(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) { setError('请输入用户名和密码'); return; }
    setLoading(true);
    setError('');
    const result = await login(username, password);
    setLoading(false);
    if (result.success) {
      redirectByRole();
    } else {
      setError(result.error || '登录失败');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) { setError('请输入用户名'); return; }
    if (!email || !isValidEmail(email)) { setError('请输入正确的邮箱'); return; }
    if (!code) { setError('请输入验证码'); return; }
    if (!isValidPassword(password)) {
      setError('密码至少6位，必须包含字母和数字');
      return;
    }
    if (password !== confirmPwd) { setError('两次输入的密码不一致'); return; }
    setLoading(true);
    setError('');
    const result = await register(username, email, code, password);
    setLoading(false);
    if (result.success) {
      redirectByRole();
    } else {
      setError(result.error || '注册失败');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !isValidEmail(email)) { setError('请输入正确的邮箱'); return; }
    if (!code) { setError('请输入验证码'); return; }
    if (!isValidPassword(password)) {
      setError('密码至少6位，必须包含字母和数字');
      return;
    }
    if (password !== confirmPwd) { setError('两次输入的密码不一致'); return; }
    setLoading(true);
    setError('');
    try {
      await authApi.resetPassword(email, code, password);
      setLoading(false);
      setError('');
      setMode('login');
      setPassword('');
      setConfirmPwd('');
      setCode('');
      setEmail('');
      setCodeSent(false);
      alert('密码重置成功，请使用新密码登录');
    } catch (err: any) {
      setLoading(false);
      setError(err.response?.data?.detail || '重置失败');
    }
  };

  const quickLogin = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
  };

  const switchMode = (m: PageMode) => {
    setMode(m);
    setError('');
    setPassword('');
    setConfirmPwd('');
    setCode('');
    setCodeSent(false);
    setCountdown(0);
    if (countdownRef.current) clearInterval(countdownRef.current);
  };

  const inputStyle = (field: string) => ({
    width: '100%', height: 40, padding: '0 14px',
    border: `1px solid ${focusedField === field ? '#4A6FA5' : '#DCDFE6'}`,
    borderRadius: 6, fontSize: 14, color: '#2C3E50',
    outline: 'none', boxSizing: 'border-box' as const,
    boxShadow: focusedField === field ? '0 0 0 3px rgba(74,111,165,0.12)' : 'none',
    transition: 'all 0.2s',
  });

  const modeTitle = mode === 'login' ? '欢迎登录' : mode === 'register' ? '账号注册' : '重置密码';
  const modeDesc = mode === 'login' ? '使用您的账号密码登录系统' : mode === 'register' ? '首次使用请验证邮箱并设置密码' : '通过邮箱验证码重置密码';

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
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 48, position: 'relative', overflow: 'hidden',
      }} className="hidden lg:flex">
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

      {/* Right form */}
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

          <h2 style={{ fontSize: 24, fontWeight: 600, color: '#2C3E50', marginBottom: 8 }}>{modeTitle}</h2>
          <p style={{ fontSize: 14, color: '#7F8C8D', marginBottom: 32 }}>{modeDesc}</p>

          {/* LOGIN FORM */}
          {mode === 'login' && (
            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#2C3E50', marginBottom: 6 }}>用户名</label>
                <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                  onFocus={() => setFocusedField('username')} onBlur={() => setFocusedField(null)}
                  placeholder="请输入用户名" style={inputStyle('username')} />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#2C3E50', marginBottom: 6 }}>密码</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPwd ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)}
                    onFocus={() => setFocusedField('password')} onBlur={() => setFocusedField(null)}
                    placeholder="请输入密码" style={{ ...inputStyle('password'), padding: '0 40px 0 14px' }} />
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#A4B0BE', padding: 0 }}>
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && <div style={{ background: '#FFEAEA', border: '1px solid #FFCCCC', borderRadius: 6, padding: '10px 14px', fontSize: 13, color: '#C46B6B', marginBottom: 16 }}>{error}</div>}

              <button type="submit" disabled={loading} style={{
                width: '100%', height: 42, background: loading ? '#A4B0BE' : '#4A6FA5',
                color: '#FFFFFF', border: 'none', borderRadius: 6, fontSize: 15, fontWeight: 500,
                cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                {loading && <Loader2 size={16} className="animate-spin" />}登录
              </button>

              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between' }}>
                <button onClick={() => switchMode('forgot_password')} style={{ background: 'none', border: 'none', color: '#7F8C8D', cursor: 'pointer', fontSize: 13 }}>
                  忘记密码？
                </button>
                <span style={{ fontSize: 13, color: '#7F8C8D' }}>
                  没有账号？
                  <button onClick={() => switchMode('register')} style={{ background: 'none', border: 'none', color: '#4A6FA5', cursor: 'pointer', fontSize: 13, fontWeight: 500, padding: 0, marginLeft: 4 }}>去注册</button>
                </span>
              </div>

              {/* Quick login hints */}
              <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid #E8ECF0' }}>
                <div style={{ fontSize: 12, color: '#A4B0BE', marginBottom: 12, textAlign: 'center' }}>演示账号（点击快速填入）</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[
                    { label: '管理员', user: 'admin', pass: 'admin123', color: '#4A6FA5', bg: '#EBF3FF' },
                    { label: '教师', user: 'teacher1', pass: 'teacher123', color: '#6B8F71', bg: '#EDFAF2' },
                    { label: '学生', user: 'student1', pass: 'student123', color: '#7A8F9E', bg: '#F0F2F5' },
                  ].map(item => (
                    <button key={item.label} onClick={() => quickLogin(item.user, item.pass)}
                      style={{ flex: 1, padding: '8px 0', background: item.bg, color: item.color, border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </form>
          )}

          {/* REGISTER FORM */}
          {mode === 'register' && (
            <form onSubmit={handleRegister}>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#2C3E50', marginBottom: 6 }}>用户名</label>
                <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                  onFocus={() => setFocusedField('username')} onBlur={() => setFocusedField(null)}
                  placeholder="请输入学号或工号" style={inputStyle('username')} />
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#2C3E50', marginBottom: 6 }}>
                  <Mail size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />邮箱
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    onFocus={() => setFocusedField('email')} onBlur={() => setFocusedField(null)}
                    placeholder="请输入邮箱" style={{ ...inputStyle('email'), flex: 1 }} />
                  <button type="button" onClick={handleSendCode} disabled={sendingCode || countdown > 0}
                    style={{
                      padding: '0 14px', height: 40, border: '1px solid #D0D5DD', borderRadius: 6,
                      background: countdown > 0 ? '#F0F2F5' : '#FFFFFF', color: countdown > 0 ? '#A4B0BE' : '#4A6FA5',
                      cursor: countdown > 0 ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0,
                    }}>
                    {sendingCode ? '发送中...' : countdown > 0 ? `${countdown}s` : codeSent ? '重新发送' : '发送验证码'}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#2C3E50', marginBottom: 6 }}>
                  <KeyRound size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />验证码
                </label>
                <input type="text" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onFocus={() => setFocusedField('code')} onBlur={() => setFocusedField(null)}
                  placeholder="6位数字验证码" maxLength={6} style={inputStyle('code')} />
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#2C3E50', marginBottom: 6 }}>密码</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPwd ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)}
                    onFocus={() => setFocusedField('password')} onBlur={() => setFocusedField(null)}
                    placeholder="至少6位，包含字母和数字" style={{ ...inputStyle('password'), padding: '0 40px 0 14px' }} />
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#A4B0BE', padding: 0 }}>
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#2C3E50', marginBottom: 6 }}>确认密码</label>
                <input type={showPwd ? 'text' : 'password'} value={confirmPwd}
                  onChange={e => setConfirmPwd(e.target.value)}
                  onFocus={() => setFocusedField('confirmPwd')} onBlur={() => setFocusedField(null)}
                  placeholder="再次输入密码" style={inputStyle('confirmPwd')} />
              </div>

              {error && <div style={{ background: '#FFEAEA', border: '1px solid #FFCCCC', borderRadius: 6, padding: '10px 14px', fontSize: 13, color: '#C46B6B', marginBottom: 16 }}>{error}</div>}

              <button type="submit" disabled={loading} style={{
                width: '100%', height: 42, background: loading ? '#A4B0BE' : '#4A6FA5',
                color: '#FFFFFF', border: 'none', borderRadius: 6, fontSize: 15, fontWeight: 500,
                cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                {loading && <Loader2 size={16} className="animate-spin" />}注册
              </button>

              <div style={{ marginTop: 20, textAlign: 'center' }}>
                <span style={{ fontSize: 13, color: '#7F8C8D' }}>
                  已有账号？
                  <button onClick={() => switchMode('login')} style={{ background: 'none', border: 'none', color: '#4A6FA5', cursor: 'pointer', fontSize: 13, fontWeight: 500, padding: 0, marginLeft: 4 }}>去登录</button>
                </span>
              </div>
            </form>
          )}

          {/* FORGOT PASSWORD FORM */}
          {mode === 'forgot_password' && (
            <form onSubmit={handleResetPassword}>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#2C3E50', marginBottom: 6 }}>
                  <Mail size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />注册邮箱
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    onFocus={() => setFocusedField('email')} onBlur={() => setFocusedField(null)}
                    placeholder="请输入注册时的邮箱" style={{ ...inputStyle('email'), flex: 1 }} />
                  <button type="button" onClick={handleSendCode} disabled={sendingCode || countdown > 0}
                    style={{
                      padding: '0 14px', height: 40, border: '1px solid #D0D5DD', borderRadius: 6,
                      background: countdown > 0 ? '#F0F2F5' : '#FFFFFF', color: countdown > 0 ? '#A4B0BE' : '#4A6FA5',
                      cursor: countdown > 0 ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0,
                    }}>
                    {sendingCode ? '发送中...' : countdown > 0 ? `${countdown}s` : codeSent ? '重新发送' : '发送验证码'}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#2C3E50', marginBottom: 6 }}>
                  <KeyRound size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />验证码
                </label>
                <input type="text" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onFocus={() => setFocusedField('code')} onBlur={() => setFocusedField(null)}
                  placeholder="6位数字验证码" maxLength={6} style={inputStyle('code')} />
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#2C3E50', marginBottom: 6 }}>新密码</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPwd ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)}
                    onFocus={() => setFocusedField('password')} onBlur={() => setFocusedField(null)}
                    placeholder="至少6位，包含字母和数字" style={{ ...inputStyle('password'), padding: '0 40px 0 14px' }} />
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#A4B0BE', padding: 0 }}>
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#2C3E50', marginBottom: 6 }}>确认新密码</label>
                <input type={showPwd ? 'text' : 'password'} value={confirmPwd}
                  onChange={e => setConfirmPwd(e.target.value)}
                  onFocus={() => setFocusedField('confirmPwd')} onBlur={() => setFocusedField(null)}
                  placeholder="再次输入新密码" style={inputStyle('confirmPwd')} />
              </div>

              {error && <div style={{ background: '#FFEAEA', border: '1px solid #FFCCCC', borderRadius: 6, padding: '10px 14px', fontSize: 13, color: '#C46B6B', marginBottom: 16 }}>{error}</div>}

              <button type="submit" disabled={loading} style={{
                width: '100%', height: 42, background: loading ? '#A4B0BE' : '#4A6FA5',
                color: '#FFFFFF', border: 'none', borderRadius: 6, fontSize: 15, fontWeight: 500,
                cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                {loading && <Loader2 size={16} className="animate-spin" />}重置密码
              </button>

              <div style={{ marginTop: 20, textAlign: 'center' }}>
                <button onClick={() => switchMode('login')} style={{ background: 'none', border: 'none', color: '#4A6FA5', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                  返回登录
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
