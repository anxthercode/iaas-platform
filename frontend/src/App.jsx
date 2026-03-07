import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useApp } from './context/AppContext';
import Topnav from './components/Topnav';
import Toast from './components/Toast';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForcePwPage from './pages/ForcePwPage';
import VMList from './pages/VMList';
import CreateVMPage from './pages/CreateVMPage';
import TenantsPage from './pages/TenantsPage';
import UsersPage from './pages/UsersPage';
import NetworkPage from './pages/NetworkPage';
import QuotaPage from './pages/QuotaPage';
import AuditPage from './pages/AuditPage';
import MonitoringPage from './pages/MonitoringPage';
import InfrastructurePage from './pages/InfrastructurePage';
import AnalyticsPage from './pages/AnalyticsPage';
import RequestsPage from './pages/RequestsPage';
import TasksPage from './pages/TasksPage';
import ChatWidget from './components/ChatWidget';

function AppLayout({ children }) {
  return (
    <div className="app-shell">
      <Topnav />
      <div className="main-content">{children}</div>
      <ChatWidget />
    </div>
  );
}

function Guard({ children }) {
  const { role, loading } = useApp();
  if (loading) {
    return (
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        height: '100vh', fontSize: 16, color: '#64748b', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ fontSize: 32 }}>MTC</div>
        <div>Loading...</div>
      </div>
    );
  }
  if (!role) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Toast />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/force-pw" element={<ForcePwPage />} />

        <Route path="/dashboard" element={<Navigate to="/vms" replace />} />
        <Route path="/vms" element={
          <Guard><AppLayout><VMList /></AppLayout></Guard>
        } />
        <Route path="/vms/create" element={
          <Guard><AppLayout><CreateVMPage /></AppLayout></Guard>
        } />
        <Route path="/tenants" element={
          <Guard><AppLayout><TenantsPage /></AppLayout></Guard>
        } />
        <Route path="/users" element={
          <Guard><AppLayout><UsersPage /></AppLayout></Guard>
        } />
        <Route path="/network" element={
          <Guard><AppLayout><NetworkPage /></AppLayout></Guard>
        } />
        <Route path="/quota" element={
          <Guard><AppLayout><QuotaPage /></AppLayout></Guard>
        } />
        <Route path="/audit" element={
          <Guard><AppLayout><AuditPage /></AppLayout></Guard>
        } />
        <Route path="/monitoring" element={
          <Guard><AppLayout><MonitoringPage /></AppLayout></Guard>
        } />
        <Route path="/infrastructure" element={
          <Guard><AppLayout><InfrastructurePage /></AppLayout></Guard>
        } />
        <Route path="/analytics" element={
          <Guard><AppLayout><AnalyticsPage /></AppLayout></Guard>
        } />
        <Route path="/requests" element={
          <Guard><AppLayout><RequestsPage /></AppLayout></Guard>
        } />
        <Route path="/tasks" element={
          <Guard><AppLayout><TasksPage /></AppLayout></Guard>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
