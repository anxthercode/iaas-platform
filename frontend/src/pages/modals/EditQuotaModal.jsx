import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';

function QuotaField({ label, icon, value, onChange, min, max, used, unit }) {
  const pct = value > 0 ? Math.min(100, Math.round((used / value) * 100)) : 0;
  const barColor = pct >= 90 ? 'var(--red)' : pct >= 70 ? 'var(--orange)' : 'var(--blue)';

  return (
    <div style={{
      border: '1.5px solid var(--border)',
      borderRadius: 14,
      padding: '18px 20px',
      background: 'var(--card)',
      transition: 'border-color 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{
          width: 36, height: 36, borderRadius: 9,
          background: barColor + '12', color: barColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 800, flexShrink: 0,
        }}>
          {icon}
        </span>
        <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{label}</span>
      </div>

      <input
        type="number" value={value} onChange={onChange}
        min={min} max={max}
        style={{
          width: '100%', padding: '10px 14px',
          border: '1.5px solid var(--border)', borderRadius: 9,
          fontFamily: 'var(--font)', fontSize: 15,
          color: 'var(--text)', background: 'var(--card)', outline: 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
          marginBottom: 10,
        }}
      />

      <div style={{
        height: 6, background: 'var(--bg2)', borderRadius: 4, overflow: 'hidden', marginBottom: 8,
      }}>
        <div style={{
          width: pct + '%', height: '100%', background: barColor,
          borderRadius: 4, transition: 'width 0.5s ease',
        }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text3)' }}>
        <span>Используется: <b style={{ color: 'var(--text2)' }}>{used}{unit ? ` ${unit}` : ''}</b></span>
        <span style={{ color: barColor, fontWeight: 700 }}>{pct}%</span>
      </div>
    </div>
  );
}

export default function EditQuotaModal({ open, onClose, tenant }) {
  const { updateQuota } = useApp();
  const [form, setForm] = useState({ vm: 10, cpu: 20, ram: 40, disk: 500 });

  useEffect(() => {
    if (tenant?.quota) setForm({ ...tenant.quota });
  }, [tenant]);

  if (!open || !tenant) return null;
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: +e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    await updateQuota(tenant.id, form);
    onClose();
  };

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <div>
            <div className="modal-title">Квота: {tenant.name}</div>
            <div className="modal-sub">tenant-id: {tenant.id}</div>
          </div>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <QuotaField
                label="Лимит ВМ" icon="VM"
                value={form.vm} onChange={set('vm')}
                min={tenant.usage?.vm || 0} max={500}
                used={tenant.usage?.vm || 0}
              />
              <QuotaField
                label="vCPU" icon="CPU"
                value={form.cpu} onChange={set('cpu')}
                min={tenant.usage?.cpu || 0} max={1000}
                used={tenant.usage?.cpu || 0}
              />
              <QuotaField
                label="RAM" icon="RAM"
                value={form.ram} onChange={set('ram')}
                min={tenant.usage?.ram || 0} max={4096}
                used={tenant.usage?.ram || 0} unit="GB"
              />
              <QuotaField
                label="Disk" icon="HDD"
                value={form.disk} onChange={set('disk')}
                min={tenant.usage?.disk || 0} max={20000}
                used={tenant.usage?.disk || 0} unit="GB"
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn-primary">Сохранить квоту</button>
          </div>
        </form>
      </div>
    </div>
  );
}
