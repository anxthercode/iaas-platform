const STATUS_MAP = {
  active:       { cls: 's-active',       label: 'Active' },
  stopped:      { cls: 's-stopped',      label: 'Stopped' },
  creating:     { cls: 's-creating',     label: 'Creating' },
  provisioning: { cls: 's-provisioning', label: 'Provisioning' },
  error:        { cls: 's-error',        label: 'Error' },
  suspended:    { cls: 's-suspended',    label: 'Suspended' },
  online:       { cls: 's-active',       label: 'Online' },
  offline:      { cls: 's-error',        label: 'Offline' },
  draining:     { cls: 's-draining',     label: 'Draining' },
  session:      { cls: 's-session',      label: 'Session' },
  expired:      { cls: 's-stopped',      label: 'Expired' },
};

export default function StatusBadge({ status }) {
  const info = STATUS_MAP[status?.toLowerCase()] || { cls: 's-stopped', label: status || '—' };
  return (
    <span className={`status ${info.cls}`}>
      <span className="dot" />
      {info.label}
    </span>
  );
}
