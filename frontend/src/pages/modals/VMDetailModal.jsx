import { useApp } from '../../context/AppContext';
import StatusBadge from '../../components/StatusBadge';

export default function VMDetailModal({ vm, open, onClose }) {
  const { vmAction } = useApp();
  if (!open || !vm) return null;

  const handleAction = (action) => {
    vmAction(vm.id, action);
    if (action === 'delete') onClose();
  };

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <div>
            <div className="modal-title">{vm.name}</div>
            <div className="modal-sub font-mono">{vm.id}</div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="kv-row"><span className="kv-key">Статус</span><span className="kv-val"><StatusBadge status={vm.status} /></span></div>
          <div className="kv-row"><span className="kv-key">Образ</span><span className="kv-val">{vm.image}</span></div>
          <div className="kv-row"><span className="kv-key">Конфигурация</span><span className="kv-val">{vm.cpu} vCPU · {vm.ram} GB RAM · {vm.disk} GB Disk</span></div>
          <div className="kv-row"><span className="kv-key">IP адрес</span><span className="kv-val">{vm.ip || '—'}</span></div>
          <div className="kv-row"><span className="kv-key">Нода</span><span className="kv-val">{vm.node || '—'}</span></div>
          <div className="kv-row"><span className="kv-key">Создана</span><span className="kv-val">{vm.created}</span></div>

          <div className="sep" />
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {vm.status !== 'active' && (
              <button className="btn btn-success btn-sm" onClick={() => handleAction('start')}>▶ Запустить</button>
            )}
            {vm.status === 'active' && (
              <button className="btn btn-ghost btn-sm" onClick={() => handleAction('stop')}>⏹ Остановить</button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={() => handleAction('reboot')}>↺ Перезагрузить</button>
            <button className="btn btn-danger btn-sm" onClick={() => { if (confirm(`Удалить ВМ ${vm.name}?`)) handleAction('delete'); }}>
              🗑 Удалить
            </button>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
}
