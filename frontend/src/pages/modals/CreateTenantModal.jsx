import { useState } from 'react';
import { useApp } from '../../context/AppContext';

export default function CreateTenantModal({ open, onClose }) {
  const { createTenant } = useApp();
  const [form, setForm] = useState({ name: '', email: '', vmLimit: 10, cpuLimit: 20, ramLimit: 40, diskLimit: 500 });
  const [error, setError] = useState('');

  if (!open) return null;
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) { setError('Заполните обязательные поля'); return; }
    await createTenant({ ...form, vmLimit: +form.vmLimit, cpuLimit: +form.cpuLimit, ramLimit: +form.ramLimit, diskLimit: +form.diskLimit });
    setForm({ name: '', email: '', vmLimit: 10, cpuLimit: 20, ramLimit: 40, diskLimit: 500 });
    setError('');
    onClose();
  };

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <div className="modal-title">Создать тенант</div>
            <div className="modal-sub">новый изолированный проект</div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid form-2col">
              <div className="field">
                <label>Название организации *</label>
                <input value={form.name} onChange={set('name')} placeholder="Acme Corp" />
              </div>
              <div className="field">
                <label>Email администратора *</label>
                <input type="email" value={form.email} onChange={set('email')} placeholder="admin@acme.com" />
              </div>
            </div>
            <div className="sep" />
            <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 13 }}>Квота ресурсов</div>
            <div className="form-grid form-2col">
              <div className="field">
                <label>Лимит ВМ</label>
                <input type="number" value={form.vmLimit} onChange={set('vmLimit')} min={1} max={200} />
              </div>
              <div className="field">
                <label>vCPU</label>
                <input type="number" value={form.cpuLimit} onChange={set('cpuLimit')} min={1} max={500} />
              </div>
              <div className="field">
                <label>RAM (GB)</label>
                <input type="number" value={form.ramLimit} onChange={set('ramLimit')} min={1} max={2000} />
              </div>
              <div className="field">
                <label>Disk (GB)</label>
                <input type="number" value={form.diskLimit} onChange={set('diskLimit')} min={10} max={10000} />
              </div>
            </div>
            {error && <div className="err-box"><span>⚠</span> {error}</div>}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn-primary">Создать тенант</button>
          </div>
        </form>
      </div>
    </div>
  );
}
