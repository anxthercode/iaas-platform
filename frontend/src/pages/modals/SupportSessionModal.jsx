import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useNavigate } from 'react-router-dom';

export default function SupportSessionModal({ open, onClose }) {
  const { tenants, createSupportSession, enterSupportMode } = useApp();
  const navigate = useNavigate();
  const [form, setForm] = useState({ tenantId: '', scope: 'read-only', reason: '' });

  if (!open) return null;
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleStart = () => {
    if (!form.tenantId) return;
    const { session, tenantId, tenantName } = createSupportSession(form);
    enterSupportMode(tenantId, tenantName, form.scope);
    onClose();
    navigate('/vms');
  };

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <div className="modal-title">Открыть Support Session</div>
            <div className="modal-sub">сессия будет записана в аудит-лог</div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Тенант</label>
            <select value={form.tenantId} onChange={set('tenantId')}>
              <option value="">— выберите тенант —</option>
              {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Уровень доступа</label>
            <select value={form.scope} onChange={set('scope')}>
              <option value="read-only">Read-Only (просмотр)</option>
              <option value="limited-write">Limited Write (ограниченная запись)</option>
              <option value="full">Full Access (полный доступ)</option>
            </select>
          </div>
          <div className="field">
            <label>Причина / тикет</label>
            <input value={form.reason} onChange={set('reason')} placeholder="Тикет #4821 — ВМ не запускается" />
          </div>
          <div className="warn-box">
            <span>⚠</span>
            Все действия в рамках сессии записываются в аудит-лог и не могут быть удалены.
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Отмена</button>
          <button className="btn btn-support" onClick={handleStart} disabled={!form.tenantId}>
            Начать сессию
          </button>
        </div>
      </div>
    </div>
  );
}