import { useState } from 'react';
import { useApp } from '../../context/AppContext';

export default function InviteUserModal({ open, onClose }) {
  const { inviteUser } = useApp();
  const [form, setForm] = useState({ name: '', email: '', role: 'tenant-user' });
  const [error, setError] = useState('');

  if (!open) return null;
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email.trim()) { setError('Введите email'); return; }
    await inviteUser(form);
    setForm({ name: '', email: '', role: 'tenant-user' });
    setError('');
    onClose();
  };

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <div className="modal-title">Пригласить пользователя</div>
            <div className="modal-sub">будет отправлен временный пароль</div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="field">
              <label>Имя (необязательно)</label>
              <input value={form.name} onChange={set('name')} placeholder="Иван Иванов" />
            </div>
            <div className="field">
              <label>Email *</label>
              <input type="email" value={form.email} onChange={set('email')} placeholder="user@company.com" />
            </div>
            <div className="field">
              <label>Роль</label>
              <select value={form.role} onChange={set('role')}>
                <option value="tenant-admin">Tenant Admin — полное управление организацией</option>
                <option value="tenant-user">Tenant User — управление ВМ в рамках квот</option>
                </select>
            </div>
            {error && <div className="err-box"><span>⚠</span> {error}</div>}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn-primary">Пригласить</button>
          </div>
        </form>
      </div>
    </div>
  );
}
