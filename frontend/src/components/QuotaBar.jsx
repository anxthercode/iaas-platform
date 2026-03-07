export default function QuotaBar({ label, used, total, unit = '', colorCls = 'qfill-blue', icon }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const dangerCls = pct >= 90 ? 'qfill-danger' : pct >= 70 ? 'qfill-warn' : colorCls;

  const colorMap = {
    'qfill-blue': { hex: '#1d6ef5', bg: 'rgba(29,110,245,0.15)', border: '#5a9af8' },
    'qfill-green': { hex: '#0d9c6e', bg: 'rgba(13,156,110,0.15)', border: '#2dbe8a' },
    'qfill-yellow': { hex: '#e0901a', bg: 'rgba(224,144,26,0.15)', border: '#e8a640' },
    'qfill-red': { hex: '#e8002d', bg: 'rgba(232,0,45,0.15)', border: '#e8365a' },
    'qfill-warn': { hex: '#f05e1c', bg: 'rgba(240,94,28,0.15)', border: '#f07a40' },
    'qfill-danger': { hex: '#e8002d', bg: 'rgba(232,0,45,0.15)', border: '#e8365a' },
  };
  const palette = colorMap[dangerCls] || colorMap['qfill-blue'];

  const borderColor = pct >= 90 ? colorMap['qfill-danger'].border
    : pct >= 70 ? colorMap['qfill-warn'].border
    : palette.border;

  const r = 32;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <div className="quota-bar-card" style={{ borderColor }}>
      <div className="quota-bar-card-top">
        {icon && <span className="quota-bar-icon" style={{ background: palette.bg }}>{icon}</span>}
        <div className="quota-bar-card-title">
          <span className="quota-bar-label">{label}</span>
          <span className="quota-bar-values">
            {used}{unit} <span className="quota-bar-slash">/</span> {total}{unit}
          </span>
        </div>
        <svg width={76} height={76} viewBox="0 0 76 76" style={{ flexShrink: 0 }}>
          <circle cx={38} cy={38} r={r} fill="none" stroke="#f0f2f5" strokeWidth={7} />
          <circle cx={38} cy={38} r={r} fill="none" stroke={palette.hex} strokeWidth={7}
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
            transform="rotate(-90 38 38)"
            style={{ transition: 'stroke-dasharray 0.7s ease' }} />
          <text x={38} y={38} textAnchor="middle" dominantBaseline="central"
            style={{ fontSize: 16, fontWeight: 900, fill: palette.hex, fontFamily: 'Cairo, sans-serif' }}>
            {pct}%
          </text>
        </svg>
      </div>
    </div>
  );
}
