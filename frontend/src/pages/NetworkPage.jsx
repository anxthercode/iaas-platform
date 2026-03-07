import { useApp } from '../context/AppContext';
import Topbar from '../components/Topbar';

export default function NetworkPage() {
  const { firewallRules, addFWRule, removeFWRule, tenants } = useApp();
  const myTenant = tenants[0];

  return (
    <div>
      <Topbar title="Сеть и Firewall" breadcrumb="// network.config">
        <button className="btn btn-primary" onClick={addFWRule}>+ Добавить правило</button>
      </Topbar>
      <div className="page-content">
        <div className="grid-2" style={{ marginBottom: 24 }}>
          <div className="card">
            <div className="card-header"><span className="card-title">Сетевая конфигурация</span></div>
            <div className="card-body">
              <div className="kv-row"><span className="kv-key">Сеть</span><span className="kv-val font-mono">net-{myTenant?.id}-private</span></div>
              <div className="kv-row"><span className="kv-key">CIDR</span><span className="kv-val font-mono">192.168.100.0/24</span></div>
              <div className="kv-row"><span className="kv-key">Шлюз</span><span className="kv-val font-mono">192.168.100.1</span></div>
              <div className="kv-row"><span className="kv-key">DNS</span><span className="kv-val font-mono">8.8.8.8, 8.8.4.4</span></div>
              <div className="kv-row"><span className="kv-key">VLAN ID</span><span className="kv-val font-mono">100</span></div>
            </div>
          </div>
          <div className="card">
            <div className="card-header"><span className="card-title">Плавающие IP</span></div>
            <div className="card-body">
              <div className="info-box" style={{ marginBottom: 14 }}>
                <span>ℹ</span>
                Плавающие IP назначаются автоматически при создании ВМ с публичным доступом.
              </div>
              <div className="kv-row"><span className="kv-key">Пул IP</span><span className="kv-val font-mono">185.12.44.0/24</span></div>
              <div className="kv-row"><span className="kv-key">Использовано</span><span className="kv-val font-mono">2 / 10</span></div>
            </div>
          </div>
        </div>

        <div className="table-wrap">
          <div className="table-top">
            <span className="table-title">Правила Firewall</span>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>{firewallRules.length} правил</span>
          </div>
          <table className="data-table">
            <thead><tr>
              <th>Действие</th><th>Направление</th><th>Протокол</th><th>Порт</th><th>Источник/Назначение</th><th>Комментарий</th><th></th>
            </tr></thead>
            <tbody>
              {firewallRules.map(r => (
                <tr key={r.id}>
                  <td>
                    <span className={r.action === 'allow' ? 'fw-action-allow' : 'fw-action-deny'}>
                      {r.action === 'allow' ? '✓ ALLOW' : '✕ DENY'}
                    </span>
                  </td>
                  <td><span className="tag tag-gray">{r.direction}</span></td>
                  <td className="font-mono">{r.protocol}</td>
                  <td className="font-mono">{r.port}</td>
                  <td className="font-mono" style={{ fontSize: 12 }}>{r.source}</td>
                  <td style={{ fontSize: 12, color: 'var(--text2)' }}>{r.comment}</td>
                  <td>
                    <button className="btn btn-danger btn-xs" onClick={() => removeFWRule(r.id)}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
