import { useApp } from '../context/AppContext';
import Topbar from '../components/Topbar';
import StatusBadge from '../components/StatusBadge';
import { useNavigate } from 'react-router-dom';

function getColor(pct) {
  if (pct >= 85) return '#ef4444';
  if (pct >= 60) return '#f59e0b';
  return '#22c55e';
}

function MiniBar({ pct }) {
  const color = getColor(pct);
  return (
    <div style={{ background: '#f0f0f0', borderRadius: 4, height: 6, marginTop: 6, overflow: 'hidden' }}>
      <div style={{ width: pct + '%', height: '100%', background: color, borderRadius: 4, transition: 'width 0.4s' }} />
    </div>
  );
}

function KpiCard({ label, value, sub, accent, alert }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14, padding: '22px 24px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
      borderLeft: alert ? '4px solid #ef4444' : `4px solid ${accent}`,
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 900, color: alert ? '#ef4444' : accent, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 13, color: '#6b7280' }}>{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { role, tenants, getAllVMs, auditLog, proxmoxNodes, registrationRequests } = useApp();
  const navigate = useNavigate();

  if (role !== 'provider-admin') {
    // Tenant dashboard redirect
    navigate('/vms');
    return null;
  }

  const allVMs = getAllVMs();
  const activeTenants = tenants.filter(t => t.status === 'active').length;
  const suspendedTenants = tenants.filter(t => t.status === 'suspended').length;
  const activeVMs = allVMs.filter(v => v.status === 'active').length;
  const nodesOnline = proxmoxNodes.filter(n => n.status === 'online').length;
  const totalCPU = proxmoxNodes.reduce((s, n) => s + n.cpuTotal, 0);
  const usedCPU  = proxmoxNodes.reduce((s, n) => s + n.cpuUsed, 0);
  const totalRAM = proxmoxNodes.reduce((s, n) => s + n.ramTotal, 0);
  const usedRAM  = proxmoxNodes.reduce((s, n) => s + n.ramUsed, 0);
  const cpuPct   = Math.round(usedCPU / totalCPU * 100);
  const ramPct   = Math.round(usedRAM / totalRAM * 100);
  const pendingReqs = registrationRequests.filter(r => r.status === 'pending').length;

  // Health score
  const issues = [];
  if (cpuPct >= 85) issues.push('Высокая загрузка CPU кластера');
  if (ramPct >= 85) issues.push('Высокая загрузка RAM кластера');
  if (suspendedTenants > 0) issues.push(`${suspendedTenants} тенант(а) приостановлено`);
  if (pendingReqs > 0) issues.push(`${pendingReqs} заявок ожидают обработки`);
  const healthColor = issues.length === 0 ? '#22c55e' : issues.length <= 1 ? '#f59e0b' : '#ef4444';
  const healthLabel = issues.length === 0 ? 'Всё в норме' : issues.length <= 1 ? 'Требует внимания' : 'Критично';

  return (
    <div>
      <Topbar title="Дашборд" />
      <div className="page-content">

        {/* Health Banner */}
        <div style={{
          background: healthColor + '12', border: `1px solid ${healthColor}40`,
          borderRadius: 12, padding: '14px 20px', marginBottom: 24,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: healthColor, boxShadow: `0 0 8px ${healthColor}` }} />
            <span style={{ fontWeight: 700, fontSize: 15, color: healthColor }}>{healthLabel}</span>
            {issues.length > 0 && (
              <span style={{ color: '#6b7280', fontSize: 14 }}>· {issues.join(' · ')}</span>
            )}
          </div>
          <span style={{ fontSize: 12, color: '#9ca3af' }}>Обновлено только что</span>
        </div>

        {/* KPI Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14, marginBottom: 24 }}>
          <KpiCard label="Тенанты"   value={tenants.length}       sub={`${activeTenants} активных`}   accent="#3b82f6" alert={suspendedTenants > 0} />
          <KpiCard label="Всего ВМ"  value={allVMs.length}         sub={`${activeVMs} running`}         accent="#22c55e" />
          <KpiCard label="CPU"       value={cpuPct + '%'}          sub={`${usedCPU} / ${totalCPU} ядер`} accent={getColor(cpuPct)} alert={cpuPct >= 85} />
          <KpiCard label="RAM"       value={ramPct + '%'}          sub={`${usedRAM} / ${totalRAM} GB`}   accent={getColor(ramPct)} alert={ramPct >= 85} />
          <KpiCard label="Ноды"      value={proxmoxNodes.length}   sub={`${nodesOnline} online`}         accent="#8b5cf6" />
          <KpiCard label="Заявки"    value={pendingReqs}           sub="ожидают решения"                 accent={pendingReqs > 0 ? '#f59e0b' : '#9ca3af'} alert={pendingReqs > 0} />
        </div>

        {/* Resource bars */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          {/* CPU/RAM per node */}
          <div style={{ background: '#fff', borderRadius: 14, padding: '22px 24px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 18 }}>Загрузка нод</div>
            {proxmoxNodes.map(n => {
              const cp = Math.round(n.cpuUsed / n.cpuTotal * 100);
              const rp = Math.round(n.ramUsed / n.ramTotal * 100);
              return (
                <div key={n.id} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                    <span className="font-mono">{n.host}</span>
                    <span style={{ color: n.status === 'online' ? '#22c55e' : '#ef4444', fontSize: 12 }}>{n.status}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#6b7280' }}>
                    <span style={{ minWidth: 40 }}>CPU</span>
                    <div style={{ flex: 1 }}>
                      <MiniBar pct={cp} />
                    </div>
                    <span style={{ color: getColor(cp), fontWeight: 700, minWidth: 36, textAlign: 'right' }}>{cp}%</span>
                  </div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                    <span style={{ minWidth: 40 }}>RAM</span>
                    <div style={{ flex: 1 }}>
                      <MiniBar pct={rp} />
                    </div>
                    <span style={{ color: getColor(rp), fontWeight: 700, minWidth: 36, textAlign: 'right' }}>{rp}%</span>
                  </div>
                </div>
              );
            })}
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 8, width: '100%' }} onClick={() => navigate('/infrastructure')}>
              Подробнее →
            </button>
          </div>

          {/* Tenant quota snapshot */}
          <div style={{ background: '#fff', borderRadius: 14, padding: '22px 24px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 18 }}>Квоты тенантов</div>
            {tenants.map(t => {
              const cpuP = Math.round(t.usage.cpu / t.quota.cpu * 100);
              const ramP = Math.round(t.usage.ram / t.quota.ram * 100);
              const maxP = Math.max(cpuP, ramP);
              return (
                <div key={t.id} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #f3f4f6' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{t.name}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 8,
                      background: getColor(maxP) + '18', color: getColor(maxP),
                    }}>
                      {t.status === 'suspended' ? 'SUSPENDED' : maxP >= 85 ? 'КРИТИЧНО' : maxP >= 60 ? 'ПОВЫШ.' : 'НОРМА'}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                    <div>
                      <span style={{ color: '#9ca3af' }}>CPU </span>
                      <span style={{ color: getColor(cpuP), fontWeight: 600 }}>{cpuP}%</span>
                      <MiniBar pct={cpuP} />
                    </div>
                    <div>
                      <span style={{ color: '#9ca3af' }}>RAM </span>
                      <span style={{ color: getColor(ramP), fontWeight: 600 }}>{ramP}%</span>
                      <MiniBar pct={ramP} />
                    </div>
                  </div>
                </div>
              );
            })}
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 4, width: '100%' }} onClick={() => navigate('/tenants')}>
              Управление тенантами →
            </button>
          </div>
        </div>

        {/* Recent audit */}
        <div style={{ background: '#fff', borderRadius: 14, padding: '22px 24px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <span style={{ fontWeight: 800, fontSize: 15 }}>Последние события</span>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/audit')}>Аудит →</button>
          </div>
          {auditLog.slice(0, 6).map((e, i) => (
            <div key={i} className="audit-row" style={{ fontSize: 14 }}>
              <span className="audit-time">{e.time}</span>
              <span className="audit-actor" style={{ fontWeight: 600 }}>{e.actor}</span>
              <span className="audit-action">{e.action}</span>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}