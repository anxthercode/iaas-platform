import { useState } from 'react';
import { useApp } from '../context/AppContext';
import Topbar from '../components/Topbar';
import StatusBadge from '../components/StatusBadge';
import SupportSessionModal from './modals/SupportSessionModal';

export default function SupportSessionsPage() {
  const { supportSessions, endSupportSession } = useApp();
  const [showCreate, setShowCreate] = useState(false);

  const active = supportSessions.filter(s => s.status === 'active');
  const expired = supportSessions.filter(s => s.status === 'expired');

  return (
    <div>
      <Topbar title="Support Sessions">
        <button className="btn btn-support" style={{ fontSize: 15, padding: '10px 22px' }} onClick={() => setShowCreate(true)}>
          + Открыть сессию
        </button>
      </Topbar>

      <div className="page-content">
        {/* Active sessions alert */}
        {active.length > 0 && (
          <div style={{
            background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 12,
            padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, fontSize: 14,
          }}>
            <span style={{ fontSize: 20 }}>⚡</span>
            <strong>{active.length} активных сессий</strong>
            <span style={{ color: '#6b7280' }}>— завершите их после решения задачи</span>
          </div>
        )}

        {/* Active sessions */}
        {active.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 14, color: '#dc2626' }}>
              ● Активные сессии
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {active.map(s => (
                <div key={s.id} style={{
                  background: '#fff', borderRadius: 12, padding: '18px 22px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.06)', borderLeft: '4px solid #ef4444',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{s.engineer}</div>
                      <div style={{ fontSize: 12, color: '#9ca3af', fontFamily: 'monospace' }}>{s.id}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{s.tenant}</div>
                      <span style={{ background: s.scope === 'read-only' ? '#dcfce7' : '#fee2e2', color: s.scope === 'read-only' ? '#16a34a' : '#dc2626', padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700 }}>
                        {s.scope}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: '#6b7280' }}>
                      <div>{s.reason}</div>
                      <div className="font-mono" style={{ fontSize: 11, marginTop: 2 }}>{s.started} → {s.expires}</div>
                    </div>
                  </div>
                  <button className="btn btn-danger btn-sm" onClick={() => endSupportSession(s.id)}>
                    Завершить
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Session history */}
        <div style={{ background: '#fff', borderRadius: 14, padding: '22px 24px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 18 }}>
            История сессий {expired.length > 0 && <span style={{ fontSize: 13, color: '#9ca3af', fontWeight: 400 }}>({expired.length} завершено)</span>}
          </div>
          {expired.length === 0 ? (
            <div className="empty-state" style={{ padding: '32px 0' }}>
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-title">Нет завершённых сессий</div>
            </div>
          ) : (
            <table className="data-table" style={{ fontSize: 14 }}>
              <thead><tr>
                <th>ID</th><th>Инженер</th><th>Тенант</th><th>Scope</th><th>Причина</th><th>Время</th><th>Статус</th>
              </tr></thead>
              <tbody>
                {expired.map(s => (
                  <tr key={s.id}>
                    <td className="font-mono" style={{ fontSize: 11 }}>{s.id}</td>
                    <td style={{ fontWeight: 600 }}>{s.engineer}</td>
                    <td>{s.tenant}</td>
                    <td><span style={{ background: '#f3f4f6', color: '#6b7280', padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600 }}>{s.scope}</span></td>
                    <td style={{ fontSize: 13, color: 'var(--text2)', maxWidth: 200 }}>{s.reason}</td>
                    <td className="font-mono" style={{ fontSize: 11, color: 'var(--text3)' }}>{s.started} → {s.expires}</td>
                    <td><StatusBadge status={s.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <SupportSessionModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}