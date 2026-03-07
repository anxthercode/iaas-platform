import { useState } from 'react';
import { useApp } from '../context/AppContext';
import Topbar from '../components/Topbar';
import StatusBadge from '../components/StatusBadge';
import InviteUserModal from './modals/InviteUserModal';

const ROLE_LABELS = { 'tenant-admin': 'Tenant Admin', 'tenant-user': 'Tenant User', 'auditor': 'Auditor' };
const ROLE_BADGE_CLS = { 'tenant-admin': 'tag-blue', 'tenant-user': 'tag-green', 'auditor': 'tag-purple' };

export default function UsersPage() {
  const { members, removeUser, role } = useApp();
  const [showInvite, setShowInvite] = useState(false);
  const myUsers = members || [];
  const canManage = role === 'tenant-admin';

  return (
    <div>
      <Topbar title="Пользователи">
        {canManage && <button className="btn btn-primary" style={{ fontSize: 15, padding: '10px 22px' }} onClick={() => setShowInvite(true)}>+ Пригласить</button>}
      </Topbar>
      <div className="page-content">
        <div className="table-wrap">
          <div className="table-top">
            <span className="table-title" style={{ fontSize: 16 }}>Пользователи организации</span>
          </div>
          {myUsers.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">👤</div>
              <div className="empty-state-title" style={{ fontSize: 18 }}>Нет пользователей</div>
              <div className="empty-state-sub">Пригласите первого пользователя</div>
            </div>
          ) : (
            <table className="data-table" style={{ fontSize: 14 }}>
              <thead><tr>
                <th>Пользователь</th><th>Роль</th><th>Статус</th><th>Создан</th>{canManage && <th>Действия</th>}
              </tr></thead>
              <tbody>
                {myUsers.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div className="user-avatar" style={{ background: '#3b82f6', width: 36, height: 36, fontSize: 14 }}>
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 15 }}>{u.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text3)' }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className={`tag ${ROLE_BADGE_CLS[u.role] || 'tag-gray'}`}>{ROLE_LABELS[u.role] || u.role}</span></td>
                    <td><StatusBadge status={u.status} /></td>
                    <td style={{ fontSize: 13, color: 'var(--text3)' }}>{u.created}</td>
                    {canManage && (
                      <td>
                        {u.role !== 'auditor' ? (
                          <button className="btn btn-danger btn-xs" onClick={() => { if (confirm(`Удалить ${u.email}?`)) removeUser(u.id); }}>
                            Удалить
                          </button>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--text3)' }}>—</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <InviteUserModal open={showInvite} onClose={() => setShowInvite(false)} />
    </div>
  );
}