import { useApp } from '../context/AppContext';

const ICONS = { success: '✓', error: '✕', info: 'i', warn: '!' };

export default function Toast() {
  const { toasts, dismissToast } = useApp();
  if (!toasts || toasts.length === 0) return null;
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`toast toast-${t.type}`}
          onClick={() => dismissToast(t.id)}
          style={{ cursor: 'pointer' }}
        >
          <div className="toast-icon">{ICONS[t.type] || 'i'}</div>
          <div>
            <div className="toast-title">{t.title}</div>
            {t.msg && <div className="toast-msg">{t.msg}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}