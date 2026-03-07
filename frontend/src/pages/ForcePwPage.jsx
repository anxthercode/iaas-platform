import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

export default function ForcePwPage() {
  const { showToast } = useApp();
  const navigate = useNavigate();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (pw.length < 8) { setError('Пароль должен содержать минимум 8 символов'); return; }
    if (pw !== pw2) { setError('Пароли не совпадают'); return; }
    showToast('success', 'Пароль изменён', 'Вы будете перенаправлены на главную страницу');
    setTimeout(() => navigate('/vms'), 1000);
  };

  return (
    <div className="force-pw-screen">
      <div className="force-pw-card">
        <div className="force-pw-badge">⚠ Требуется смена пароля</div>
        <div className="force-pw-title">Установите новый пароль</div>
        <p className="force-pw-sub">Это временный пароль. Пожалуйста, установите постоянный пароль для защиты вашего аккаунта.</p>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Новый пароль</label>
            <div className="field-password">
              <input type={showPw ? 'text' : 'password'} value={pw} onChange={e => setPw(e.target.value)} placeholder="Минимум 8 символов" />
              <button type="button" className="pw-toggle" onClick={() => setShowPw(v => !v)} tabIndex={-1}>
                {showPw ? <EyeOff /> : <Eye />}
              </button>
            </div>
          </div>
          <div className="field">
            <label>Подтвердите пароль</label>
            <div className="field-password">
              <input type={showPw2 ? 'text' : 'password'} value={pw2} onChange={e => setPw2(e.target.value)} placeholder="Повторите пароль" />
              <button type="button" className="pw-toggle" onClick={() => setShowPw2(v => !v)} tabIndex={-1}>
                {showPw2 ? <EyeOff /> : <Eye />}
              </button>
            </div>
          </div>
          {error && <div className="err-box" style={{ marginBottom: 16 }}><span>⚠</span> {error}</div>}
          <button type="submit" className="login-btn">Сохранить пароль</button>
        </form>
      </div>
    </div>
  );
}
