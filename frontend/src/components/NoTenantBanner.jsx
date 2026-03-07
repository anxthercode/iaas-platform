import { useNavigate } from 'react-router-dom';

export default function NoTenantBanner({ user }) {
  const navigate = useNavigate();
  return (
    <div style={{
      margin: '40px auto', maxWidth: 600, textAlign: 'center',
      padding: 40, background: '#fff', borderRadius: 16,
      border: '1px solid #e0e0e0', boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
        Ожидание активации
      </div>
      <div style={{ color: '#64748b', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
        Ваш аккаунт <strong>{user?.email}</strong> создан и ожидает назначения тенанта
        администратором платформы.<br />
        После активации вы получите доступ к виртуальным машинам и ресурсам.
      </div>
      <div style={{
        display: 'inline-block', padding: '10px 20px',
        background: '#f0f9ff', border: '1px solid #bae6fd',
        borderRadius: 8, fontSize: 13, color: '#0369a1',
      }}>
        ℹ Обычное время ожидания: от нескольких минут до 1 рабочего дня
      </div>
      <div style={{ marginTop: 24 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/login')}>
          Выйти из аккаунта
        </button>
      </div>
    </div>
  );
}
