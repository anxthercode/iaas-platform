import { useState } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

const Eye = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
);
const EyeOff = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

const BrandLogo = ({ size = 36 }) => (
  <svg width={size * 0.76} height={size} viewBox="0 0 37 49" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="33" height="45" rx="10" fill="#FF0000" />
    <path
      d="M11 26C11 21.58 14.58 18 19 18C22.87 18 26 21.13 26 25C26 28.87 22.87 32 19 32H14"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ROLES = [
  { id: 'provider-admin', icon: '🏢', name: 'Provider Admin', desc: 'IaaS платформа · полный доступ к инфраструктуре и управлению тенантами', color: '#e8002d', email: 'admin@iaas.local', pw: 'admin123' },
  { id: 'tenant-admin',   icon: '🔑', name: 'Tenant Admin',   desc: 'ACME Corp · управление ВМ, пользователями, квотами', color: '#1d6ef5', email: 'aleksei@acme.com', pw: 'user123' },
  { id: 'tenant-user',    icon: '👤', name: 'Tenant User',    desc: 'ACME Corp · запуск ВМ, просмотр ресурсов', color: '#0d9c6e', email: 'maria@acme.com', pw: 'user123' },
];

export default function LoginPage() {
  const { login, role } = useApp();
  const navigate = useNavigate();
  const [selected, setSelected] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPw, setShowPw] = useState(false);

  if (role) return <Navigate to="/vms" replace />;

  const handleSelectRole = (r) => {
    setSelected(r.id);
    setEmail(r.email);
    setPassword(r.pw);
    setError('');
  };

  const handleLogin = async (e) => {
    e?.preventDefault?.();
    if (!email || !password) { setError('Введите email и пароль'); return; }
    setError('');
    setLoading(true);
    try {
      const me = await login(email, password);
      if (me.must_change_password) {
        navigate('/force-pw');
      } else {
        navigate('/vms');
      }
    } catch (err) {
      const detail = err.response?.data?.detail || err.response?.data?.error;
      setError(detail || 'Неверный email или пароль');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-bg-pattern" />
      <div className="login-card" style={{ maxWidth: 480 }}>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#8fa3b8', fontSize: 13, marginBottom: 20, padding: 0 }}>
          ← Вернуться на главную
        </button>
        <div className="login-logo">
          <BrandLogo size={36} />
          <span className="login-logo-text">Cloud <span>IaaS</span></span>
        </div>
        <div className="login-subtitle" style={{ marginTop: 16 }}>Добро пожаловать</div>
        <div className="login-desc">Выберите роль для быстрого входа или введите свои данные</div>
        <div className="role-grid" style={{ gridTemplateColumns: '1fr', gap: 10, marginTop: 20 }}>
          {ROLES.map(r => (
            <div key={r.id} className={`role-card${selected === r.id ? ' selected' : ''}`} onClick={() => handleSelectRole(r)}
              style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px' }}>
              <span style={{ fontSize: 26 }}>{r.icon}</span>
              <div>
                <div className="role-name">{r.name}</div>
                <div className="role-desc">{r.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleLogin} style={{ marginTop: 16 }}>
          <div className="field">
            <label>Email</label>
            <input
              type="email" value={email} onChange={e => { setEmail(e.target.value); setSelected(''); }}
              placeholder="your@email.com" autoComplete="email"
            />
          </div>
          <div className="field">
            <label>Пароль</label>
            <div className="field-password">
              <input
                type={showPw ? 'text' : 'password'} value={password} onChange={e => { setPassword(e.target.value); setSelected(''); }}
                placeholder="••••••••" autoComplete="current-password"
              />
              <button type="button" className="pw-toggle" onClick={() => setShowPw(v => !v)} tabIndex={-1}>
                {showPw ? <EyeOff /> : <Eye />}
              </button>
            </div>
          </div>
          {error && <div className="err-box" style={{ marginBottom: 12 }}><span>⚠</span> {error}</div>}
          <button className="login-btn" type="submit" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? '⏳ Вход...' : 'Войти в систему'}
          </button>
        </form>

        <div style={{ marginTop: 16, textAlign: 'center', fontSize: 12, color: '#8fa3b8' }}>
          Нет аккаунта?{' '}
          <Link to="/register" style={{ color: '#e8002d', fontWeight: 600 }}>Подать заявку</Link>
        </div>
      </div>
    </div>
  );
}
