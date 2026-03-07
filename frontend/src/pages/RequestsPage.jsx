import { useState } from 'react';
import { useApp } from '../context/AppContext';
import Topbar from '../components/Topbar';

export default function RequestsPage() {
  const { registrationRequests, processRequest } = useApp();
  const [tab, setTab] = useState('pending');

  const pending  = registrationRequests.filter(r => r.status === 'pending');
  const approved = registrationRequests.filter(r => r.status === 'approved');
  const rejected = registrationRequests.filter(r => r.status === 'rejected');

  const tabs = [
    { key: 'all',      label: 'Все',       count: registrationRequests.length, color: '#6b7280' },
    { key: 'pending',  label: 'Ожидают',   count: pending.length,  color: '#f59e0b' },
    { key: 'approved', label: 'Одобрены',  count: approved.length, color: '#22c55e' },
    { key: 'rejected', label: 'Отклонены', count: rejected.length, color: '#ef4444' },
  ];

  const filtered = tab === 'all' ? registrationRequests : registrationRequests.filter(r => r.status === tab);

  const statusStyle = {
    pending:  { bg: '#fef3c7', color: '#d97706', label: 'Ожидает' },
    approved: { bg: '#dcfce7', color: '#16a34a', label: 'Одобрено' },
    rejected: { bg: '#fee2e2', color: '#dc2626', label: 'Отклонено' },
  };

  return (
    <div>
      <Topbar title="Заявки на регистрацию" />
      <div className="page-content">

        {/* Tab bar — contains the counts, no need for separate stat cards */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#f3f4f6', borderRadius: 12, padding: 4 }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flex: 1, padding: '10px 8px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 14,
              background: tab === t.key ? '#fff' : 'transparent',
              color: tab === t.key ? '#1a2332' : '#6b7280',
              fontWeight: tab === t.key ? 700 : 500,
              boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              {t.label}
              {t.count > 0 && (
                <span style={{
                  background: tab === t.key ? t.color : '#d1d5db',
                  color: tab === t.key ? '#fff' : '#6b7280',
                  borderRadius: 20, padding: '1px 8px', fontSize: 12, fontWeight: 700,
                }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state" style={{ padding: '60px 0' }}>
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-title" style={{ fontSize: 18 }}>Нет заявок</div>
            <div className="empty-state-sub">В этой категории заявок нет</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map(req => {
              const st = statusStyle[req.status];
              return (
                <div key={req.id} style={{
                  background: '#fff', borderRadius: 14, padding: '20px 24px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
                  borderLeft: `4px solid ${st.color}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <span style={{ fontWeight: 800, fontSize: 16 }}>{req.name}</span>
                        <span style={{ background: '#f3f4f6', color: '#6b7280', padding: '2px 10px', borderRadius: 10, fontSize: 12, fontWeight: 600 }}>
                          {req.type === 'tenant' ? '🏢 Тенант' : '👤 Пользователь'}
                        </span>
                        <span style={{ background: st.bg, color: st.color, padding: '2px 10px', borderRadius: 10, fontSize: 12, fontWeight: 700 }}>
                          {st.label}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 20, fontSize: 13, color: '#6b7280', flexWrap: 'wrap' }}>
                        <span>📧 {req.email}</span>
                        {req.org   && <span>🏢 {req.org}</span>}
                        {req.phone && <span>📱 {req.phone}</span>}
                        <span style={{ color: '#9ca3af' }}>🕐 {req.date}</span>
                      </div>
                      {req.comment && (
                        <div style={{ marginTop: 10, padding: '10px 14px', background: '#f8fafc', borderRadius: 8, fontSize: 13, color: '#4b5563', lineHeight: 1.5 }}>
                          💬 {req.comment}
                        </div>
                      )}
                    </div>
                    {req.status === 'pending' && (
                      <div style={{ display: 'flex', gap: 8, marginLeft: 20, flexShrink: 0 }}>
                        <button className="btn btn-success btn-sm" style={{ fontSize: 14, padding: '8px 16px' }} onClick={() => processRequest(req.id, 'approved')}>
                          ✓ Одобрить
                        </button>
                        <button className="btn btn-danger btn-sm" style={{ fontSize: 14, padding: '8px 16px' }} onClick={() => processRequest(req.id, 'rejected')}>
                          ✕ Отклонить
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}