import { NavLink, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

const NAV_PROVIDER = [
  { to: '/tenants',        label: 'Тенанты' },
  { to: '/infrastructure', label: 'Инфраструктура' },
  { to: '/tasks',          label: 'Proxmox Tasks' },
  { to: '/analytics',      label: 'AI Анализ' },
  { to: '/audit',          label: 'Аудит' },
  { to: '/requests',       label: 'Заявки', badge: true },
];

// Tenant Admin: no Dashboard (redirects to /vms anyway), only real pages
const NAV_TENANT_ADMIN = [
  { to: '/vms',        label: 'Виртуальные машины' },
  { to: '/quota',      label: 'Квота' },
  { to: '/users',      label: 'Пользователи' },
  { to: '/requests',   label: 'Заявки', badge: true },
  { to: '/audit',      label: 'Аудит' },
  { to: '/monitoring', label: 'Мониторинг' },
];

const NAV_TENANT_USER = [
  { to: '/vms',   label: 'Виртуальные машины' },
  { to: '/quota', label: 'Моя квота' },
];

const ROLE_META = {
  'provider-admin': { label: 'Provider Admin', cls: 'rb-admin',       name: 'Cloud IaaS Admin', email: 'admin@iaas.local',     color: '#e63946' },
  'tenant-admin':   { label: 'Tenant Admin',   cls: 'rb-tenant-admin', name: 'Алексей Козлов',  email: 'aleksei@acme.com', color: '#3b82f6' },
  'tenant-user':    { label: 'Tenant User',    cls: 'rb-tenant-user',  name: 'Мария Иванова',   email: 'maria@acme.com',   color: '#22c55e' },
};

function BrandLogo() {
  return (
    <svg width="38" height="38" viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="4" width="30" height="30" rx="9" fill="#E8002D" />
      <path
        d="M13 21C13 18.24 15.24 16 18 16C20.76 16 23 18.24 23 21C23 23.76 20.76 26 18 26H14.5"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Topnav() {
  const { role, user, logout, inSupportMode, supportTenant, exitSupportMode, pendingRequestsCount } = useApp();
  const navigate = useNavigate();
  if (!role) return null;
  const baseMeta = ROLE_META[role] || ROLE_META['tenant-user'];
  const meta = user ? {
    ...baseMeta,
    name: user.full_name || user.email?.split('@')[0] || baseMeta.name,
    email: user.email || baseMeta.email,
  } : baseMeta;
  const navItems = role === 'provider-admin' ? NAV_PROVIDER
    : role === 'tenant-admin' ? NAV_TENANT_ADMIN
    : NAV_TENANT_USER;
  const handleLogout = () => { logout(); navigate('/login'); };
  const logoTo = role === 'provider-admin' ? '/tenants' : '/vms';

  return (
    <>
      {inSupportMode && (
        <div className="support-banner">
          <div className="support-banner-left">
            <span className="support-badge">⚡ SUPPORT MODE</span>
            <span>Вы работаете в тенанте: <strong>{supportTenant}</strong></span>
          </div>
          <button
            className="btn btn-sm"
            style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}
            onClick={exitSupportMode}
          >
            Завершить сессию
          </button>
        </div>
      )}
      <nav className="topnav">
        <div className="topnav-inner">
          <NavLink to={logoTo} className="topnav-logo" style={{ textDecoration: 'none' }}>
            <BrandLogo />
            <span className="topnav-logo-text">Cloud <span>IaaS</span></span>
          </NavLink>

          <div className="topnav-nav">
            {navItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => 'topnav-item' + (isActive ? ' active' : '')}
                style={{ textDecoration: 'none' }}
              >
                {item.label}
                {item.badge && pendingRequestsCount > 0 && (
                  <span className="topnav-badge">{pendingRequestsCount}</span>
                )}
              </NavLink>
            ))}
          </div>

          <div className="topnav-right">
            <span className={`topnav-role-badge ${meta.cls}`}>{meta.label}</span>
            <div className="topnav-user">
              <div className="user-avatar" style={{ background: meta.color }}>
                {meta.name.charAt(0)}
              </div>
              <div>
                <div className="topnav-user-name">{meta.name}</div>
                <div className="topnav-user-role">{meta.email}</div>
              </div>
            </div>
            <button className="topnav-logout-btn" onClick={handleLogout}>Выйти</button>
          </div>
        </div>
      </nav>
    </>
  );
}