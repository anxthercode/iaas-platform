export default function Topbar({ title, children }) {
  return (
    <div className="page-header">
      <div className="page-header-left">
        <div className="page-title">{title}</div>
      </div>
      {children && <div className="page-header-right">{children}</div>}
    </div>
  );
}