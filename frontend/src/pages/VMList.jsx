import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Topbar from '../components/Topbar';
import StatusBadge from '../components/StatusBadge';
import VMDetailModal from './modals/VMDetailModal';

export default function VMList() {
  const { getMyVMs, vmAction, role } = useApp();
  const navigate = useNavigate();
  const [selectedVM, setSelectedVM] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const canCreate = role !== 'auditor';
  const vms = getMyVMs();
  const filtered = vms.filter(v => {
    const matchSearch = !search || v.name.includes(search) || v.ip?.includes(search) || v.image.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || v.status === filter;
    return matchSearch && matchFilter;
  });

  return (
    <div>
      <Topbar title="Виртуальные машины">
        {canCreate && <button className="btn btn-primary" style={{ fontSize: 15, padding: '10px 22px' }} onClick={() => navigate('/vms/create')}>+ Создать ВМ</button>}
      </Topbar>
      <div className="page-content">
        <div className="table-wrap">
          <div className="table-top">
            <span className="table-title" style={{ fontSize: 16 }}>Инстансы</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input placeholder="Поиск по имени, IP, образу..." value={search} onChange={e => setSearch(e.target.value)}
                style={{ padding: '8px 14px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, width: 260 }} />
              <select value={filter} onChange={e => setFilter(e.target.value)}
                style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14 }}>
                <option value="all">Все статусы</option>
                <option value="active">Active</option>
                <option value="stopped">Stopped</option>
                <option value="creating">Creating</option>
              </select>
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🖥️</div>
              <div className="empty-state-title" style={{ fontSize: 18 }}>{vms.length === 0 ? 'Нет виртуальных машин' : 'Ничего не найдено'}</div>
              <div className="empty-state-sub">{vms.length === 0 ? 'Создайте первую ВМ с помощью кнопки выше' : 'Попробуйте изменить параметры поиска'}</div>
            </div>
          ) : (
            <table className="data-table" style={{ fontSize: 14 }}>
              <thead><tr>
                <th>Имя / ID</th><th>Образ</th><th>Конфигурация</th><th>IP</th><th>Нода</th><th>Создана</th><th>Статус</th><th>Действия</th>
              </tr></thead>
              <tbody>
                {filtered.map(vm => (
                  <tr key={vm.id} className="clickable" onClick={() => setSelectedVM(vm)}>
                    <td>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{vm.name}</div>
                      <div className="font-mono" style={{ color: 'var(--text3)', fontSize: 11 }}>{vm.id}</div>
                    </td>
                    <td style={{ fontSize: 13 }}>{vm.image}</td>
                    <td className="font-mono" style={{ fontSize: 12 }}>{vm.cpu}C · {vm.ram}G · {vm.disk}G</td>
                    <td className="font-mono" style={{ fontSize: 13 }}>{vm.ip || <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                    <td className="font-mono" style={{ fontSize: 12, color: 'var(--text3)' }}>{vm.node || '—'}</td>
                    <td style={{ fontSize: 13, color: 'var(--text3)' }}>{vm.created}</td>
                    <td><StatusBadge status={vm.status} /></td>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {vm.status !== 'active' && <button className="btn btn-success btn-xs" onClick={() => vmAction(vm.id, 'start')}>▶</button>}
                        {vm.status === 'active' && <button className="btn btn-ghost btn-xs" onClick={() => vmAction(vm.id, 'stop')}>⏹</button>}
                        <button className="btn btn-ghost btn-xs" onClick={() => vmAction(vm.id, 'reboot')}>↺</button>
                        <button className="btn btn-danger btn-xs" onClick={() => { if (confirm(`Удалить ВМ ${vm.name}?`)) vmAction(vm.id, 'delete'); }}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <VMDetailModal vm={selectedVM} open={!!selectedVM} onClose={() => setSelectedVM(null)} />
    </div>
  );
}