import { useApp } from '../context/AppContext';
import Topbar from '../components/Topbar';

function getColor(pct) {
  if (pct >= 85) return '#ef4444';
  if (pct >= 60) return '#f59e0b';
  return '#22c55e';
}

function getStatusLabel(pct) {
  if (pct >= 85) return 'Критично';
  if (pct >= 60) return 'Повышенное';
  return 'В норме';
}

function DonutCard({ label, used, total, unit, pct }) {
  const color = getColor(pct);
  const r = 90;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const statusLabel = getStatusLabel(pct);

  return (
    <div style={{
      background: '#fff', borderRadius: 20, padding: '36px 28px',
      border: `6px solid ${color}44`,
      boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
    }}>
      <svg width={220} height={220} viewBox="0 0 220 220">
        <circle cx={110} cy={110} r={r} fill="none" stroke="#d5d9e0" strokeWidth={16} />
        <circle cx={110} cy={110} r={r} fill="none" stroke={color} strokeWidth={16}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 110 110)"
          style={{ transition: 'stroke-dasharray 0.7s ease' }} />
        <text x={110} y={100} textAnchor="middle" dominantBaseline="middle"
          style={{ fontSize: 34, fontWeight: 900, fill: color, fontFamily: 'Cairo, sans-serif' }}>
          {pct}%
        </text>
        <text x={110} y={128} textAnchor="middle" dominantBaseline="middle"
          style={{ fontSize: 14, fill: '#6b7280', fontFamily: 'Cairo, sans-serif' }}>
          использовано
        </text>
      </svg>

      <div style={{ textAlign: 'center', width: '100%' }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: '#000000', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
          {label}
        </div>
        <div style={{ fontSize: 32, fontWeight: 900, color: '#000000', lineHeight: 1, marginBottom: 4 }}>
          {used} <span style={{ fontSize: 24, color: '#000000', fontWeight: 700 }}>/</span> {total}
        </div>
        <div style={{ fontSize: 15, color: '#6b7280' }}>{unit}</div>
      </div>
    </div>
  );
}

export default function QuotaPage() {
  const { tenants } = useApp();
  const myTenant = tenants[0];
  if (!myTenant) return null;
  const { quota, usage } = myTenant;

  const pctVM   = quota.vm   ? Math.round(usage.vm   / quota.vm   * 100) : 0;
  const pctCPU  = quota.cpu  ? Math.round(usage.cpu  / quota.cpu  * 100) : 0;
  const pctRAM  = quota.ram  ? Math.round(usage.ram  / quota.ram  * 100) : 0;
  const pctDisk = quota.disk ? Math.round(usage.disk / quota.disk * 100) : 0;

  const resources = [
    { label: 'Виртуальные машины', used: usage.vm,   total: quota.vm,   unit: 'штук',  pct: pctVM   },
    { label: 'vCPU',               used: usage.cpu,  total: quota.cpu,  unit: 'ядер',  pct: pctCPU  },
    { label: 'RAM',                used: usage.ram,  total: quota.ram,  unit: 'GB',    pct: pctRAM  },
    { label: 'Disk',               used: usage.disk, total: quota.disk, unit: 'GB',    pct: pctDisk },
  ];

  return (
    <div>
      <Topbar title="Квота ресурсов" />
      <div className="page-content">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, maxWidth: 900, margin: '0 auto' }}>
          {resources.map(r => (
            <DonutCard key={r.label} {...r} />
          ))}
        </div>
      </div>
    </div>
  );
}
