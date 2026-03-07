import { useState } from 'react';
import { useApp } from '../context/AppContext';
import Topbar from '../components/Topbar';

const ACTOR_ICONS = {
  'provider-admin': '🏢', 'provider-support': '🛠', 'aleksei@acme.com': '👤',
  'maria@acme.com': '👤', 'cto@startup.io': '👤', 'Оркестратор': '⚙️', 'Compute Agent': '🤖',
};

export default function AuditPage() {
  const { auditLog } = useApp();
  const [search, setSearch] = useState('');

  const filtered = auditLog.filter(e =>
    !search || e.action.toLowerCase().includes(search.toLowerCase()) || e.actor.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <Topbar title="Аудит">
        <button className="btn btn-ghost btn-sm" onClick={() => {
          const csv = 'time,actor,action\n' + auditLog.map(e => `${e.time},${e.actor},"${e.action}"`).join('\n');
          const a = document.createElement('a');
          a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
          a.download = 'audit-log.csv'; a.click();
        }}>↓ Экспорт CSV</button>
      </Topbar>
      <div className="page-content">
        <div className="table-wrap">
          <div className="table-top">
            <span className="table-title" style={{ fontSize: 16 }}>События ({filtered.length})</span>
            <input placeholder="Поиск по действию или актору..." value={search} onChange={e => setSearch(e.target.value)}
              style={{ padding: '8px 14px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, width: 300 }} />
          </div>
          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-title">Нет записей</div>
              <div className="empty-state-sub">Попробуйте изменить поисковый запрос</div>
            </div>
          ) : (
            filtered.map((e, i) => (
              <div key={i} className="audit-row" style={{ fontSize: 14 }}>
                <span className="audit-icon">{ACTOR_ICONS[e.actor] || '👤'}</span>
                <span className="audit-time" style={{ fontSize: 13 }}>{e.time}</span>
                <span className="audit-actor" style={{ fontSize: 13, fontWeight: 600 }}>{e.actor}</span>
                <span className="audit-action">{e.action}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}