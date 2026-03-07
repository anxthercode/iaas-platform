import { useState } from 'react';
import { useApp } from '../context/AppContext';
import Topbar from '../components/Topbar';
import StatusBadge from '../components/StatusBadge';
import QuotaBar from '../components/QuotaBar';
import CreateTenantModal from './modals/CreateTenantModal';
import EditQuotaModal from './modals/EditQuotaModal';

function getColor(pct) {
  if (pct >= 85) return '#ef4444';
  if (pct >= 60) return '#f59e0b';
  return '#22c55e';
}

export default function TenantsPage() {
  const { tenants, toggleTenantStatus, getAllVMs } = useApp();
  const [showCreate, setShowCreate] = useState(false);
  const [quotaTenant, setQuotaTenant] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = tenants.filter(t => {
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.email.includes(search);
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div>
      <Topbar title="Управление тенантами">
        <button className="btn btn-primary" style={{ fontSize: 15, padding: '10px 22px' }} onClick={() => setShowCreate(true)}>
          + Создать тенант
        </button>
      </Topbar>

      <div className="page-content">
        <div className="table-wrap">
          <div className="table-top">
            <span className="table-title" style={{ fontSize: 16 }}>Тенанты ({filtered.length})</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                placeholder="Поиск по имени или email..."
                value={search} onChange={e => setSearch(e.target.value)}
                style={{ padding: '8px 14px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, width: 260 }}
              />
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14 }}>
                <option value="all">Все статусы</option>
                <option value="active">Активные</option>
                <option value="suspended">Приостановленные</option>
              </select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🏢</div>
              <div className="empty-state-title" style={{ fontSize: 18 }}>Тенанты не найдены</div>
              <div className="empty-state-sub">Попробуйте изменить параметры поиска</div>
            </div>
          ) : (
            <table className="data-table" style={{ fontSize: 14 }}>
              <thead><tr>
                <th>Организация</th><th>Дата-центр</th><th>ВМ</th><th>vCPU</th><th>RAM</th><th>Disk</th><th>Статус</th><th>Действия</th>
              </tr></thead>
              <tbody>
                {filtered.map(t => {
                  const cpuPct  = Math.round(t.usage.cpu  / t.quota.cpu  * 100);
                  const ramPct  = Math.round(t.usage.ram  / t.quota.ram  * 100);
                  const diskPct = Math.round(t.usage.disk / t.quota.disk * 100);
                  const vmPct   = Math.round(t.usage.vm   / t.quota.vm   * 100);
                  const isExpanded = expanded === t.id;
                  return (
                    <>
                      <tr key={t.id} className="clickable" onClick={() => setExpanded(isExpanded ? null : t.id)}>
                        <td>
                          <div style={{ fontWeight: 700, fontSize: 15 }}>{t.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text3)' }}>{t.email}</div>
                        </td>
                        <td style={{ fontSize: 13, color: 'var(--text2)' }}>{t.dc}</td>
                        <td>
                          <span className="font-mono" style={{ fontSize: 13 }}>{t.usage.vm}/{t.quota.vm}</span>
                          <div style={{ width: 60, height: 4, background: '#f0f0f0', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                            <div style={{ width: vmPct + '%', height: '100%', background: getColor(vmPct), borderRadius: 2 }} />
                          </div>
                        </td>
                        <td>
                          <span className="font-mono" style={{ fontSize: 13 }}>{t.usage.cpu}/{t.quota.cpu}</span>
                          <div style={{ width: 60, height: 4, background: '#f0f0f0', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                            <div style={{ width: cpuPct + '%', height: '100%', background: getColor(cpuPct), borderRadius: 2 }} />
                          </div>
                        </td>
                        <td>
                          <span className="font-mono" style={{ fontSize: 13 }}>{t.usage.ram}/{t.quota.ram} GB</span>
                          <div style={{ width: 60, height: 4, background: '#f0f0f0', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                            <div style={{ width: ramPct + '%', height: '100%', background: getColor(ramPct), borderRadius: 2 }} />
                          </div>
                        </td>
                        <td>
                          <span className="font-mono" style={{ fontSize: 13 }}>{t.usage.disk}/{t.quota.disk} GB</span>
                          <div style={{ width: 60, height: 4, background: '#f0f0f0', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                            <div style={{ width: diskPct + '%', height: '100%', background: getColor(diskPct), borderRadius: 2 }} />
                          </div>
                        </td>
                        <td><StatusBadge status={t.status} /></td>
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-ghost btn-xs" style={{ fontSize: 13 }} onClick={() => setQuotaTenant(t)}>Квота</button>
                            <button
                              className={`btn btn-xs ${t.status === 'active' ? 'btn-danger' : 'btn-success'}`}
                              style={{ fontSize: 13 }}
                              onClick={() => toggleTenantStatus(t.id)}
                            >
                              {t.status === 'active' ? 'Suspend' : 'Resume'}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={t.id + '_exp'}>
                          <td colSpan={8} style={{ padding: '24px 28px', background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 28 }}>
                              <div>
                                <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 16, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                  Использование квоты
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                  <QuotaBar label="Виртуальные машины" used={t.usage.vm}   total={t.quota.vm}   colorCls="qfill-blue"   icon="VM" />
                                  <QuotaBar label="vCPU"              used={t.usage.cpu}  total={t.quota.cpu}  colorCls="qfill-green"  icon="CPU" />
                                  <QuotaBar label="Оперативная память" used={t.usage.ram}  total={t.quota.ram}  unit=" GB" colorCls="qfill-yellow" icon="RAM" />
                                  <QuotaBar label="Дисковое пространство" used={t.usage.disk} total={t.quota.disk} unit=" GB" colorCls="qfill-blue" icon="HDD" />
                                </div>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                <div>
                                  <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 14, color: 'var(--text)' }}>Информация</div>
                                  <div style={{ background: 'white', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
                                    {[['Org Admin', t.orgAdmin], ['Создан', t.created], ['Tenant ID', t.id], ['Дата-центр', t.dc]].map(([k, v], i, arr) => (
                                      <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 14 }}>
                                        <span style={{ color: 'var(--text3)', fontWeight: 600 }}>{k}</span>
                                        <span style={{ fontWeight: 600, fontFamily: k === 'Tenant ID' ? 'JetBrains Mono, monospace' : 'inherit', fontSize: k === 'Tenant ID' ? 12 : 14 }}>{v}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 14, color: 'var(--text)' }}>Быстрые действия</div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <button className="btn btn-ghost" style={{ justifyContent: 'flex-start', textAlign: 'left', fontSize: 14, padding: '10px 16px' }} onClick={() => setQuotaTenant(t)}>
                                      Изменить квоту
                                    </button>
                                    <button className={`btn ${t.status === 'active' ? 'btn-danger' : 'btn-success'}`} style={{ justifyContent: 'flex-start', fontSize: 14, padding: '10px 16px' }} onClick={() => toggleTenantStatus(t.id)}>
                                      {t.status === 'active' ? 'Приостановить тенант' : 'Возобновить тенант'}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <CreateTenantModal open={showCreate} onClose={() => setShowCreate(false)} />
      <EditQuotaModal open={!!quotaTenant} tenant={quotaTenant} onClose={() => setQuotaTenant(null)} />
    </div>
  );
}