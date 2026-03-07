import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import Topbar from '../components/Topbar';

function MetricBar({ value, max = 100, color = 'var(--blue)' }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, height: 8, background: 'var(--bg2)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: pct + '%', background: color, borderRadius: 4, transition: 'width 0.5s' }} />
      </div>
      <span className="font-mono" style={{ minWidth: 36, fontSize: 11, color: 'var(--text2)', textAlign: 'right' }}>{pct}%</span>
    </div>
  );
}

export default function MonitoringPage() {
  const { getMyVMs } = useApp();
  const vms = getMyVMs().filter(v => v.status === 'active');

  const [metrics, setMetrics] = useState(() =>
    Object.fromEntries(vms.map(v => [v.id, {
      cpu: Math.floor(Math.random() * 60 + 10),
      ram: Math.floor(Math.random() * 70 + 15),
      disk: Math.floor(Math.random() * 50 + 20),
      net: Math.floor(Math.random() * 100),
    }]))
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setMetrics(prev => {
        const next = { ...prev };
        vms.forEach(v => {
          if (!next[v.id]) return;
          next[v.id] = {
            cpu: Math.max(5, Math.min(95, next[v.id].cpu + (Math.random() - 0.5) * 12)),
            ram: Math.max(10, Math.min(90, next[v.id].ram + (Math.random() - 0.5) * 5)),
            disk: Math.max(15, Math.min(85, next[v.id].disk + (Math.random() - 0.5) * 2)),
            net: Math.max(0, Math.min(100, next[v.id].net + (Math.random() - 0.5) * 20)),
          };
        });
        return next;
      });
    }, 3000);
    return () => clearInterval(timer);
  }, [vms.length]);

  return (
    <div>
      <Topbar title="Мониторинг" breadcrumb="// monitoring.realtime">
        <div className="flex-row">
          <span className="status s-active"><span className="dot" /> Live</span>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>обновление каждые 3 сек</span>
        </div>
      </Topbar>
      <div className="page-content">
        {vms.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <div className="empty-state-title">Нет активных ВМ</div>
            <div className="empty-state-sub">Запустите виртуальные машины для просмотра метрик</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            {vms.map(v => {
              const m = metrics[v.id] || { cpu: 0, ram: 0, disk: 0, net: 0 };
              const cpuPct = Math.round(m.cpu);
              const cpuColor = cpuPct > 80 ? 'var(--red)' : cpuPct > 60 ? 'var(--orange)' : 'var(--blue)';
              return (
                <div key={v.id} className="card">
                  <div className="card-header">
                    <span className="card-title">
                      <span className="status s-active" style={{ marginRight: 4 }}><span className="dot" /></span>
                      {v.name}
                    </span>
                    <span className="font-mono" style={{ fontSize: 10, color: 'var(--text3)' }}>{v.id}</span>
                  </div>
                  <div className="card-body">
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>CPU ({v.cpu} vCPU)</span>
                        <span className="font-mono" style={{ fontSize: 11, color: cpuColor, fontWeight: 700 }}>{cpuPct}%</span>
                      </div>
                      <MetricBar value={m.cpu} color={cpuColor} />
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>RAM ({v.ram} GB)</span>
                        <span className="font-mono" style={{ fontSize: 11, color: 'var(--green)' }}>{Math.round(m.ram)}%</span>
                      </div>
                      <MetricBar value={m.ram} color="var(--green)" />
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>Disk ({v.disk} GB)</span>
                        <span className="font-mono" style={{ fontSize: 11, color: 'var(--yellow)' }}>{Math.round(m.disk)}%</span>
                      </div>
                      <MetricBar value={m.disk} color="var(--yellow)" />
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>Network I/O</span>
                        <span className="font-mono" style={{ fontSize: 11, color: 'var(--purple)' }}>{Math.round(m.net)} Mbps</span>
                      </div>
                      <MetricBar value={m.net} color="var(--purple)" />
                    </div>
                    <div className="sep" />
                    <div style={{ display: 'flex', gap: 16, fontSize: 11 }}>
                      <span style={{ color: 'var(--text3)' }}>IP: <span className="font-mono">{v.ip}</span></span>
                      <span style={{ color: 'var(--text3)' }}>Нода: <span className="font-mono">{v.node}</span></span>
                    </div>
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
