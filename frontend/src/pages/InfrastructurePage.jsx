import { useApp } from '../context/AppContext';
import Topbar from '../components/Topbar';
import StatusBadge from '../components/StatusBadge';

function getColor(pct) {
  if (pct >= 85) return '#ef4444';
  if (pct >= 60) return '#f59e0b';
  return '#22c55e';
}

function Bar({ pct }) {
  return (
    <div style={{ background: '#f0f0f0', borderRadius: 4, height: 8, overflow: 'hidden', minWidth: 100 }}>
      <div style={{ width: pct + '%', height: '100%', background: getColor(pct), borderRadius: 4, transition: 'width 0.4s' }} />
    </div>
  );
}

function KpiCard({ label, value, sub, accent, alert }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14, padding: '18px 20px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
      borderLeft: alert ? '4px solid #ef4444' : `4px solid ${accent}`,
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 900, color: alert ? '#ef4444' : accent, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#6b7280' }}>{sub}</div>}
    </div>
  );
}

export default function InfrastructurePage() {
  const { proxmoxNodes, getAllVMs, tenants, registrationRequests } = useApp();
  const allVMs = getAllVMs();

  const activeTenants = tenants.filter(t => t.status === 'active').length;
  const suspendedTenants = tenants.filter(t => t.status === 'suspended').length;
  const activeVMs = allVMs.filter(v => v.status === 'active').length;
  const nodesOnline = proxmoxNodes.filter(n => n.status === 'online').length;
  const totalCPU = proxmoxNodes.reduce((s, n) => s + n.cpuTotal, 0) || 1;
  const usedCPU  = proxmoxNodes.reduce((s, n) => s + n.cpuUsed, 0);
  const totalRAM = proxmoxNodes.reduce((s, n) => s + n.ramTotal, 0) || 1;
  const usedRAM  = proxmoxNodes.reduce((s, n) => s + n.ramUsed, 0);
  const cpuPct   = Math.round(usedCPU / totalCPU * 100);
  const ramPct   = Math.round(usedRAM / totalRAM * 100);
  const pendingReqs = (registrationRequests || []).filter(r => r.status === 'pending').length;

  const issues = [];
  if (cpuPct >= 85) issues.push('Высокая загрузка CPU кластера');
  if (ramPct >= 85) issues.push('Высокая загрузка RAM кластера');
  if (suspendedTenants > 0) issues.push(`${suspendedTenants} тенант(а) приостановлено`);
  if (pendingReqs > 0) issues.push(`${pendingReqs} заявок ожидают обработки`);
  const healthColor = issues.length === 0 ? '#22c55e' : issues.length <= 1 ? '#f59e0b' : '#ef4444';
  const healthLabel = issues.length === 0 ? 'Всё в норме' : issues.length <= 1 ? 'Требует внимания' : 'Критично';

  return (
    <div>
      <Topbar title="Инфраструктура Proxmox">
        <span style={{ fontSize: 13, color: 'var(--text3)', fontFamily: 'monospace' }}>Дата-центр провайдера · Москва (MOS-DC1)</span>
      </Topbar>

      <div className="page-content">
        <div style={{
          background: healthColor + '12', border: `1px solid ${healthColor}40`,
          borderRadius: 12, padding: '14px 20px', marginBottom: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: healthColor, boxShadow: `0 0 8px ${healthColor}` }} />
            <span style={{ fontWeight: 700, fontSize: 15, color: healthColor }}>{healthLabel}</span>
            {issues.length > 0 && (
              <span style={{ color: '#6b7280', fontSize: 14 }}>· {issues.join(' · ')}</span>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 24 }}>
          <KpiCard label="Тенанты" value={tenants.length} sub={`${activeTenants} активных`} accent="#3b82f6" alert={suspendedTenants > 0} />
          <KpiCard label="Всего ВМ" value={allVMs.length} sub={`${activeVMs} running`} accent="#22c55e" />
          <KpiCard label="CPU кластера" value={cpuPct + '%'} sub={`${usedCPU} / ${totalCPU} ядер`} accent={getColor(cpuPct)} alert={cpuPct >= 85} />
          <KpiCard label="RAM кластера" value={ramPct + '%'} sub={`${usedRAM} / ${totalRAM} GB`} accent={getColor(ramPct)} alert={ramPct >= 85} />
          <KpiCard label="Ноды" value={proxmoxNodes.length} sub={`${nodesOnline} online`} accent="#8b5cf6" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16, marginBottom: 24 }}>
          {proxmoxNodes.map(n => {
            const cpP = Math.round(n.cpuUsed / n.cpuTotal * 100);
            const rmP = Math.round(n.ramUsed / n.ramTotal * 100);
            return (
              <div key={n.id} style={{
                background: '#fff', borderRadius: 14, padding: '22px 24px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
                borderTop: `3px solid ${n.status === 'online' ? '#22c55e' : '#ef4444'}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, fontFamily: 'monospace' }}>{n.host}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>Uptime: {n.uptime}</div>
                  </div>
                  <StatusBadge status={n.status} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    { label: 'CPU', used: n.cpuUsed, total: n.cpuTotal, unit: 'ядер', pct: cpP },
                    { label: 'RAM', used: n.ramUsed, total: n.ramTotal, unit: 'GB',   pct: rmP },
                  ].map(({ label, used, total, unit, pct }) => (
                    <div key={label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                        <span style={{ fontWeight: 600, color: '#374151' }}>{label}</span>
                        <span style={{ color: '#6b7280' }}>
                          {used} / {total} {unit}
                          <span style={{ marginLeft: 8, color: getColor(pct), fontWeight: 700 }}>{pct}%</span>
                        </span>
                      </div>
                      <Bar pct={pct} />
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid #f3f4f6', fontSize: 13 }}>
                    <span style={{ color: '#9ca3af', fontWeight: 600 }}>Виртуальных машин</span>
                    <span style={{ fontWeight: 700 }}>{n.vms}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ background: '#fff', borderRadius: 14, padding: '22px 24px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 18 }}>Распределение ВМ по нодам</div>
          <table className="data-table" style={{ fontSize: 14 }}>
            <thead><tr>
              <th>Виртуальная машина</th><th>Тенант</th><th>Статус</th><th>CPU</th><th>RAM</th><th>Нода</th>
            </tr></thead>
            <tbody>
              {allVMs.map(vm => (
                <tr key={vm.id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{vm.name}</div>
                    <div className="font-mono" style={{ fontSize: 11, color: 'var(--text3)' }}>{vm.id}</div>
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--text2)' }}>{vm.tenant}</td>
                  <td><StatusBadge status={vm.status} /></td>
                  <td className="font-mono" style={{ fontSize: 13 }}>{vm.cpu} ядер</td>
                  <td className="font-mono" style={{ fontSize: 13 }}>{vm.ram} GB</td>
                  <td className="font-mono" style={{ fontSize: 12, color: 'var(--text3)' }}>{vm.node || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
