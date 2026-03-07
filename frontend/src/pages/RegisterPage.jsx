import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import 'flag-icons/css/flag-icons.min.css';

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

const COUNTRIES = [
  { code: 'by', name: 'Беларусь',        dial: '+375',  opLen: 2, pattern: /^\+375/ },
  { code: 'ru', name: 'Россия',           dial: '+7',    opLen: 3, pattern: /^(\+7|8|7)/ },
  { code: 'kz', name: 'Казахстан',        dial: '+7',    opLen: 3, pattern: /^(\+77|\+76)/ },
  { code: 'ua', name: 'Украина',          dial: '+380',  opLen: 2, pattern: /^\+380/ },
  { code: 'uz', name: 'Узбекистан',       dial: '+998',  opLen: 2, pattern: /^\+998/ },
  { code: 'az', name: 'Азербайджан',      dial: '+994',  opLen: 2, pattern: /^\+994/ },
  { code: 'am', name: 'Армения',          dial: '+374',  opLen: 2, pattern: /^\+374/ },
  { code: 'ge', name: 'Грузия',           dial: '+995',  opLen: 3, pattern: /^\+995/ },
  { code: 'md', name: 'Молдова',          dial: '+373',  opLen: 2, pattern: /^\+373/ },
  { code: 'kg', name: 'Кыргызстан',       dial: '+996',  opLen: 3, pattern: /^\+996/ },
  { code: 'tj', name: 'Таджикистан',      dial: '+992',  opLen: 2, pattern: /^\+992/ },
  { code: 'tm', name: 'Туркменистан',     dial: '+993',  opLen: 2, pattern: /^\+993/ },
  { code: 'de', name: 'Германия',         dial: '+49',   opLen: 3, pattern: /^\+49/ },
  { code: 'fr', name: 'Франция',          dial: '+33',   opLen: 1, pattern: /^\+33/ },
  { code: 'gb', name: 'Великобритания',   dial: '+44',   opLen: 4, pattern: /^\+44/ },
  { code: 'us', name: 'США',              dial: '+1',    opLen: 3, pattern: /^\+1/ },
  { code: 'cn', name: 'Китай',            dial: '+86',   opLen: 3, pattern: /^\+86/ },
  { code: 'tr', name: 'Турция',           dial: '+90',   opLen: 3, pattern: /^\+90/ },
  { code: 'il', name: 'Израиль',          dial: '+972',  opLen: 2, pattern: /^\+972/ },
  { code: 'ae', name: 'ОАЭ',              dial: '+971',  opLen: 2, pattern: /^\+971/ },
  { code: 'in', name: 'Индия',            dial: '+91',   opLen: 5, pattern: /^\+91/ },
  { code: 'br', name: 'Бразилия',         dial: '+55',   opLen: 2, pattern: /^\+55/ },
  { code: 'jp', name: 'Япония',           dial: '+81',   opLen: 2, pattern: /^\+81/ },
  { code: 'kr', name: 'Южная Корея',      dial: '+82',   opLen: 2, pattern: /^\+82/ },
  { code: 'it', name: 'Италия',           dial: '+39',   opLen: 3, pattern: /^\+39/ },
  { code: 'es', name: 'Испания',          dial: '+34',   opLen: 2, pattern: /^\+34/ },
  { code: 'pl', name: 'Польша',           dial: '+48',   opLen: 3, pattern: /^\+48/ },
  { code: 'nl', name: 'Нидерланды',       dial: '+31',   opLen: 2, pattern: /^\+31/ },
  { code: 'se', name: 'Швеция',           dial: '+46',   opLen: 2, pattern: /^\+46/ },
  { code: 'ch', name: 'Швейцария',        dial: '+41',   opLen: 2, pattern: /^\+41/ },
];

function formatPhone(rawDigits, country) {
  const dialDigits = country.dial.replace('+', '');
  let local = rawDigits.startsWith(dialDigits)
    ? rawDigits.slice(dialDigits.length)
    : rawDigits;

  const opLen = country.opLen;
  const op = local.slice(0, opLen);
  const rest = local.slice(opLen);

  let result = country.dial;
  if (op.length > 0) {
    result += op.length < opLen
      ? ` (${op}`
      : ` (${op})`;
  }
  if (op.length === opLen && rest.length > 0) {
    const p1 = rest.slice(0, 3);
    const p2 = rest.slice(3, 5);
    const p3 = rest.slice(5, 7);
    if (p1) result += ' ' + p1;
    if (p2) result += '-' + p2;
    if (p3) result += '-' + p3;
  }
  return result;
}

function detectCountry(input) {
  const raw = input.replace(/[\s\-()]/g, '');
  if (!raw || raw === '+') return COUNTRIES[0];
  const sorted = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  for (const c of sorted) {
    if (raw.startsWith(c.dial) || c.pattern.test(raw)) return c;
  }
  return COUNTRIES[0];
}

function Flag({ code }) {
  return (
    <span
      className={`fi fi-${code}`}
      style={{
        width: 22, height: 16, borderRadius: 3,
        display: 'inline-block', flexShrink: 0,
        boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
        backgroundSize: 'cover',
      }}
    />
  );
}

function PhoneInput({ value, onChange }) {
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [open, setOpen] = useState(false);
  const prevDigitsRef = useRef((value || '').replace(/\D/g, ''));

  const handleChange = (e) => {
    const inputVal = e.target.value;

    if (!inputVal.trim()) {
      prevDigitsRef.current = '';
      setCountry(COUNTRIES[0]);
      onChange('');
      return;
    }

    let detectStr = inputVal;
    if (!detectStr.startsWith('+')) {
      detectStr = '+' + detectStr.replace(/\+/g, '');
    }

    let newDigits = detectStr.replace(/\D/g, '');
    const oldDigits = prevDigitsRef.current;

    if (newDigits === oldDigits && inputVal.length < value.length) {
      newDigits = newDigits.slice(0, -1);
    }

    if (!newDigits) {
      prevDigitsRef.current = '';
      setCountry(COUNTRIES[0]);
      onChange('');
      return;
    }

    prevDigitsRef.current = newDigits;

    const detected = detectCountry('+' + newDigits);
    const c = detected || country;
    if (c.code !== country.code) setCountry(c);

    onChange(formatPhone(newDigits, c));
  };

  const handleSelectCountry = (c) => {
    const dialDigits = c.dial.replace('+', '');
    prevDigitsRef.current = dialDigits;
    setCountry(c);
    onChange(formatPhone(dialDigits, c));
    setOpen(false);
  };

  const placeholder = country.code === 'by'
    ? '+375 (29) 123-45-67'
    : country.code === 'ru'
    ? '+7 (925) 123-45-67'
    : `${country.dial} ...`;

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <div style={{
        position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
        display: 'flex', alignItems: 'center', pointerEvents: 'none', zIndex: 1,
      }}>
        <Flag code={country.code} />
      </div>
      <input
        type="tel"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '11px 36px 11px 46px',
          border: '1.5px solid #dde3ea', borderRadius: 9,
          fontSize: 15, fontFamily: 'Cairo, sans-serif', outline: 'none',
        }}
        onFocus={e => e.target.style.borderColor = '#1d6ef5'}
        onBlur={e => e.target.style.borderColor = '#dde3ea'}
      />
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          position: 'absolute',
          right: 10,
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: 4,
          color: '#64748b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontSize: 10,
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
          }}
        >
          ▾
        </span>
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 6,
            background: '#ffffff',
            borderRadius: 12,
            border: '1px solid #e5e8ee',
            boxShadow: '0 14px 40px rgba(15,23,42,0.18)',
            maxHeight: 260,
            overflowY: 'auto',
            zIndex: 20,
          }}
        >
          {COUNTRIES.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => handleSelectCountry(c)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                padding: '8px 12px',
                background: c.code === country.code ? 'rgba(29,110,245,0.04)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={`fi fi-${c.code}`} style={{ width: 18, height: 14, borderRadius: 3, boxShadow: '0 0 0 1px rgba(15,23,42,0.08)' }} />
                <span>{c.name}</span>
              </span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#6b7280' }}>
                {c.dial}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RegisterPage() {
  const { submitRegistration } = useApp();
  const navigate = useNavigate();
  const [type, setType] = useState('tenant');
  const [form, setForm] = useState({ name: '', email: '', org: '', phone: '', comment: '', password: '', password2: '' });
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.password || form.password.length < 6) {
      setError('Пароль должен содержать минимум 6 символов');
      return;
    }
    if (form.password !== form.password2) {
      setError('Пароли не совпадают');
      return;
    }
    const result = await submitRegistration({ type, ...form });
    if (result === true) {
      setDone(true);
    } else if (typeof result === 'string') {
      setError(result);
    }
  };

  if (done) return (
    <div className="register-screen">
      <div className="register-card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 52, marginBottom: 18 }}>✅</div>
        <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 10 }}>Аккаунт создан!</h2>
        <p style={{ color: '#4b5563', marginBottom: 28, fontSize: 16 }}>
          Вы можете войти с email <strong>{form.email}</strong> и указанным паролем.
        </p>
        <button className="btn btn-primary" onClick={() => navigate('/login')}>Вернуться ко входу</button>
      </div>
    </div>
  );

  return (
    <div className="register-screen">
      <div className="register-card">
        <div className="register-back" onClick={() => navigate('/')}>← Назад на главную</div>
        <div className="login-logo" style={{ marginBottom: 8 }}>
          <div className="login-logo-icon">☁</div>
          <span className="login-logo-text">Cloud <span>IaaS</span></span>
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8, marginTop: 22 }}>Регистрация</h2>
        <p style={{ color: '#4b5563', fontSize: 15, marginBottom: 26, fontWeight: 400 }}>
          Создайте аккаунт и сразу войдите в систему
        </p>

        <div style={{ display: 'flex', gap: 10, marginBottom: 22 }}>
          {[['tenant', '🏢 Новый тенант'], ['user', '👤 Пользователь']].map(([v, l]) => (
            <button key={v} type="button" onClick={() => setType(v)}
              className={`btn ${type === v ? 'btn-primary' : 'btn-ghost'}`} style={{ flex: 1, fontSize: 15 }}>
              {l}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Имя и фамилия</label>
            <input value={form.name} onChange={set('name')} placeholder="Иван Петров" required />
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" value={form.email} onChange={set('email')} placeholder="ivan@company.by" required />
          </div>
          <div className="field">
            <label>Телефон</label>
            <PhoneInput
              value={form.phone}
              onChange={(v) => setForm(f => ({ ...f, phone: v }))}
            />
          </div>
          <div className="form-grid form-2col">
            <div className="field">
              <label>Пароль</label>
              <div className="field-password">
                <input type={showPw ? 'text' : 'password'} value={form.password} onChange={set('password')} placeholder="Минимум 6 символов" required />
                <button type="button" className="pw-toggle" onClick={() => setShowPw(v => !v)} tabIndex={-1}>
                  {showPw ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </div>
            <div className="field">
              <label>Подтверждение пароля</label>
              <div className="field-password">
                <input type={showPw2 ? 'text' : 'password'} value={form.password2} onChange={set('password2')} placeholder="Повторите пароль" required />
                <button type="button" className="pw-toggle" onClick={() => setShowPw2(v => !v)} tabIndex={-1}>
                  {showPw2 ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </div>
          </div>
          {type === 'tenant' && (
            <div className="field">
              <label>Название организации</label>
              <input value={form.org} onChange={set('org')} placeholder="ООО Технологии Будущего" required />
            </div>
          )}
          <div className="field">
            <label>Комментарий (необязательно)</label>
            <textarea value={form.comment} onChange={set('comment')} rows={3}
              placeholder="Опишите ваши задачи и требуемые ресурсы"
              style={{ resize: 'none' }} />
          </div>
          {error && <div className="err-box" style={{ marginBottom: 12 }}><span>⚠</span> {error}</div>}
          <button type="submit" className="login-btn">Создать аккаунт</button>
        </form>
      </div>
    </div>
  );
}
