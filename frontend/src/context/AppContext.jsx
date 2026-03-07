import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { loginAPI, fetchMe, logoutCleanup, registerRequest } from '../api/auth';
import { fetchVMs, createVMAPI, deleteVMAPI, vmActionAPI, fetchNodes, fetchFlavors, fetchOSTemplates } from '../api/compute';
import {
  fetchTenants as fetchTenantsAPI, fetchTenantDetail, updateQuotaAPI,
  suspendTenantAPI, resumeTenantAPI, fetchMembers, inviteUserAPI, removeMemberAPI,
  fetchAuditLog, fetchTenantAudit, fetchRegistrationRequests,
  approveUserRequest, approveTenantRequest, rejectRequestAPI, adminCreateTenantAPI,
} from '../api/tenants';
import { initialSupportSessions, initialFirewallRules } from '../store/mockData';

const AppContext = createContext(null);

/* ── Normalizers: backend format → frontend format ── */

function normalizeTenant(t) {
  const q = t.quota || {};
  const u = t.usage || {};
  return {
    id: t.id, name: t.name, slug: t.slug || '',
    status: t.status || 'active',
    created: t.created_at ? new Date(t.created_at).toLocaleDateString('ru-RU') : '',
    email: '', orgAdmin: '', dc: '',
    quota: {
      vm: q.vm_count || 0,
      cpu: q.cpu_cores || 0,
      ram: Math.round((q.ram_mb || 0) / 1024),
      disk: q.disk_gb || 0,
    },
    usage: {
      vm: u.used_vm_count || 0,
      cpu: u.used_cpu_cores || 0,
      ram: Math.round((u.used_ram_mb || 0) / 1024),
      disk: u.used_disk_gb || 0,
    },
    memberCount: t.member_count || 0,
  };
}

function normalizeVM(vm) {
  const stateMap = { running: 'active', stopped: 'stopped', creating: 'creating', provisioning: 'creating', error: 'error', suspended: 'suspended', deleting: 'deleting' };
  return {
    id: vm.id, name: vm.name,
    status: stateMap[vm.power_state] || vm.power_state || 'stopped',
    image: vm.image_ref || '', flavor: vm.flavor || '',
    cpu: vm.vcpu || 0,
    ram: Math.round((vm.ram_mb || 0) / 1024),
    disk: vm.disk_gb || 0,
    ip: vm.ip_address || null,
    created: vm.created_at ? new Date(vm.created_at).toLocaleDateString('ru-RU') : '',
    node: vm.compute_node || null,
    tenant: vm.tenant_name || '', tenantId: vm.tenant_id || '',
    projectId: vm.project || '', description: vm.description || '',
  };
}

function normalizeNode(n) {
  return {
    id: n.id, host: n.hostname || '', status: n.status || 'online',
    cpuUsed: n.cpu_used || 0, cpuTotal: n.cpu_total || 1,
    ramUsed: Math.round((n.ram_used_mb || 0) / 1024),
    ramTotal: Math.round((n.ram_total_mb || 1024) / 1024),
    vms: n.vm_count || 0, uptime: n.uptime || '',
  };
}

function normalizeAuditEntry(e) {
  return {
    time: e.occurred_at ? new Date(e.occurred_at).toLocaleTimeString('ru-RU').slice(0, 8) : '',
    actor: e.actor_email || 'system', role: '', tenant: e.tenant || '',
    action: e.message || e.action || '',
  };
}

function normalizeRequest(r) {
  const statusMap = { submitted: 'pending', approved: 'approved', rejected: 'rejected' };
  return {
    id: r.id, type: r.type || 'user',
    name: r.full_name || '', email: r.email || '',
    org: r.company_name || '', phone: r.phone || '', comment: r.comment || '',
    date: r.created_at ? new Date(r.created_at).toLocaleString('ru-RU') : '',
    status: statusMap[r.status] || r.status, _raw: r,
  };
}

function normalizeMember(m) {
  const roleMap = { tenant_admin: 'tenant-admin', tenant_user: 'tenant-user', auditor: 'auditor' };
  return {
    id: m.id,
    name: m.user_full_name || m.user_email?.split('@')[0] || '',
    email: m.user_email || '',
    role: roleMap[m.role] || m.role, status: 'active',
    created: m.created_at ? new Date(m.created_at).toLocaleDateString('ru-RU') : '',
    userId: m.user,
  };
}

function mapRole(me) {
  if (me.is_staff) return 'provider-admin';
  if (me.role === 'tenant_admin') return 'tenant-admin';
  return 'tenant-user';
}

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  const [tenants, setTenants] = useState([]);
  const [vms, setVMs] = useState([]);
  const [members, setMembers] = useState([]);
  const [proxmoxNodes, setProxmoxNodes] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [registrationRequests, setRegistrationRequests] = useState([]);
  const [firewallRules, setFirewallRules] = useState([...initialFirewallRules]);
  const [flavors, setFlavors] = useState([]);
  const [osTemplates, setOsTemplates] = useState([]);

  const [supportSessions, setSupportSessions] = useState([...initialSupportSessions]);
  const [inSupportMode, setInSupportMode] = useState(false);
  const [supportTenant, setSupportTenant] = useState(null);
  const [supportScope, setSupportScope] = useState(null);

  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((type, title, msg = '') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [{ id, type, title, msg }, ...prev]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  /* ── Init from stored token ── */
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (token) {
      initSession();
    } else {
      setLoading(false);
    }
  }, []);

  async function initSession() {
    try {
      const me = await fetchMe();
      setUser(me);
      const r = mapRole(me);
      setRole(r);
      await loadAllData(r, me);
    } catch {
      logoutCleanup();
      setRole(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadAllData(currentRole, me) {
    try {
      if (currentRole === 'provider-admin') {
        const [t, v, n, a, rr, fl, os] = await Promise.allSettled([
          fetchTenantsAPI(), fetchVMs(), fetchNodes(),
          fetchAuditLog(), fetchRegistrationRequests(),
          fetchFlavors(), fetchOSTemplates(),
        ]);
        if (t.status === 'fulfilled') setTenants(t.value.map(normalizeTenant));
        if (v.status === 'fulfilled') setVMs(v.value.map(normalizeVM));
        if (n.status === 'fulfilled') setProxmoxNodes(n.value.map(normalizeNode));
        if (a.status === 'fulfilled') setAuditLog(a.value.map(normalizeAuditEntry));
        if (rr.status === 'fulfilled') setRegistrationRequests(rr.value.map(normalizeRequest));
        if (fl.status === 'fulfilled') setFlavors(fl.value);
        if (os.status === 'fulfilled') setOsTemplates(os.value);
      } else {
        const tenantId = me.tenant?.id;
        const isTenantAdmin = currentRole === 'tenant-admin';
        const promises = [fetchVMs(), fetchFlavors(), fetchOSTemplates()];
        if (tenantId) {
          promises.push(fetchTenantDetail(tenantId), fetchMembers(tenantId), fetchTenantAudit(tenantId));
        }
        if (isTenantAdmin) {
          promises.push(fetchRegistrationRequests());
        }
        const res = await Promise.allSettled(promises);
        if (res[0].status === 'fulfilled') setVMs(res[0].value.map(normalizeVM));
        if (res[1].status === 'fulfilled') setFlavors(res[1].value);
        if (res[2].status === 'fulfilled') setOsTemplates(res[2].value);
        if (tenantId) {
          if (res[3]?.status === 'fulfilled') setTenants([normalizeTenant(res[3].value)]);
          if (res[4]?.status === 'fulfilled') setMembers(res[4].value.map(normalizeMember));
          if (res[5]?.status === 'fulfilled') setAuditLog(res[5].value.map(normalizeAuditEntry));
        }
        const rrIdx = tenantId ? 6 : 3;
        if (isTenantAdmin && res[rrIdx]?.status === 'fulfilled') {
          setRegistrationRequests(res[rrIdx].value.map(normalizeRequest));
        }
      }
    } catch (err) {
      console.error("Data load error:", err);
    }
  }

  /* ── AUTH ── */
  const login = async (email, password) => {
    await loginAPI(email, password);
    const me = await fetchMe();
    setUser(me);
    const r = mapRole(me);
    setRole(r);
    await loadAllData(r, me);
    return me;
  };

  const logout = () => {
    logoutCleanup();
    setUser(null); setRole(null);
    setTenants([]); setVMs([]); setMembers([]);
    setProxmoxNodes([]); setAuditLog([]); setRegistrationRequests([]);
    setInSupportMode(false); setSupportTenant(null);
  };

  /* ── Refresh helpers ── */
  const refreshVMs = async () => {
    try { const d = await fetchVMs(); setVMs(d.map(normalizeVM)); } catch {}
  };
  const refreshTenants = async () => {
    try {
      if (role === 'provider-admin') {
        const d = await fetchTenantsAPI(); setTenants(d.map(normalizeTenant));
      } else if (user?.tenant?.id) {
        const d = await fetchTenantDetail(user.tenant.id); setTenants([normalizeTenant(d)]);
      }
    } catch {}
  };
  const refreshMembers = async () => {
    const tid = user?.tenant?.id;
    if (!tid) return;
    try { const d = await fetchMembers(tid); setMembers(d.map(normalizeMember)); } catch {}
  };
  const refreshAudit = async () => {
    try {
      if (role === 'provider-admin') {
        const d = await fetchAuditLog(); setAuditLog(d.map(normalizeAuditEntry));
      } else if (user?.tenant?.id) {
        const d = await fetchTenantAudit(user.tenant.id); setAuditLog(d.map(normalizeAuditEntry));
      }
    } catch {}
  };
  const refreshRequests = async () => {
    try { const d = await fetchRegistrationRequests(); setRegistrationRequests(d.map(normalizeRequest)); } catch {}
  };

  /* ── Auto-refresh VMs in transitional states ── */
  useEffect(() => {
    const hasTransitional = vms.some(v =>
      ['creating', 'deleting', 'provisioning'].includes(v.status)
    );
    if (!hasTransitional || !role) return;

    const interval = setInterval(refreshVMs, 5000);
    return () => clearInterval(interval);
  }, [vms, role]);

  /* ── VM ACTIONS ── */
  const getAllVMs = () => vms;
  const getMyVMs = () => vms;

  const createVM = async (vmData) => {
    const projectId = user?.tenant?.project_id
      || (inSupportMode && tenants.find(t => t.id === supportTenant)?.project_id)
      || vmData.project_id;
    if (!projectId) return { error: 'Нет доступного проекта для создания ВМ' };
    try {
      const payload = {
        name: vmData.name,
        project_id: projectId,
        flavor: vmData.flavor || 'medium',
        os_template: vmData.image || vmData.os_template || '',
        description: vmData.description || '',
        ssh_key: vmData.ssh_key || '',
      };
      if (vmData.flavor === 'custom' && vmData.cpu && vmData.ram && vmData.disk) {
        payload.vcpu = Number(vmData.cpu);
        payload.ram_mb = Number(vmData.ram) * 1024;
        payload.disk_gb = Number(vmData.disk);
      }
      await createVMAPI(payload);
      showToast('success', 'VM creating', `${vmData.name} queued`);
      setTimeout(refreshVMs, 2000);
      setTimeout(refreshVMs, 7000);
      setTimeout(refreshTenants, 7000);
      return { success: true };
    } catch (err) {
      const d = err.response?.data;
      let msg = d?.error || d?.detail;
      if (!msg && d && typeof d === 'object') {
        const fields = Object.entries(d).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`);
        msg = fields.length ? fields.join('; ') : null;
      }
      msg = msg || err.message || 'VM creation failed';
      console.error('createVM error:', err.response?.status, d, err.message);
      return { error: msg };
    }
  };

  const vmAction = async (vmId, action) => {
    try {
      if (action === 'delete') {
        await deleteVMAPI(vmId);
        showToast('success', 'VM deleted', '');
      } else {
        await vmActionAPI(vmId, action);
        const labels = { start: 'started', stop: 'stopped', reboot: 'rebooting', pause: 'suspended', resume: 'resumed' };
        showToast('info', 'Action done', `VM ${labels[action] || action}`);
      }
      await refreshVMs();
      await refreshTenants();
    } catch (err) {
      showToast('error', 'Error', err.response?.data?.error || 'Action failed');
    }
  };

  /* ── TENANTS ── */
  const createTenant = async (data) => {
    try {
      await adminCreateTenantAPI({
        name: data.name,
        email: data.email,
        password: data.password || 'TempPass123!',
        cpu_limit: data.cpuLimit || 10,
        ram_mb_limit: (data.ramLimit || 40) * 1024,
        disk_gb_limit: data.diskLimit || 500,
        vm_limit: data.vmLimit || 10,
      });
      showToast('success', 'Тенант создан', data.name);
      await refreshTenants();
    } catch (err) {
      showToast('error', 'Ошибка', err.response?.data?.error || 'Не удалось создать тенант');
    }
  };

  const toggleTenantStatus = async (tid) => {
    const t = tenants.find(x => x.id === tid);
    if (!t) return;
    try {
      if (t.status === 'active') {
        await suspendTenantAPI(tid);
        showToast('warn', 'Tenant suspended', t.name);
      } else {
        await resumeTenantAPI(tid);
        showToast('success', 'Tenant resumed', t.name);
      }
      await refreshTenants();
    } catch (err) {
      showToast('error', 'Error', err.response?.data?.error || 'Status change failed');
    }
  };

  const updateQuota = async (tid, quota) => {
    try {
      await updateQuotaAPI(tid, {
        cpu_cores: quota.cpu,
        ram_mb: quota.ram * 1024,
        disk_gb: quota.disk,
        vm_count: quota.vm,
      });
      showToast('success', 'Quota updated', '');
      await refreshTenants();
    } catch (err) {
      showToast('error', 'Error', err.response?.data?.error || 'Quota update failed');
    }
  };

  /* ── USERS ── */
  const inviteUser = async (userData) => {
    const tid = user?.tenant?.id;
    if (!tid) return;
    try {
      const backendRole = userData.role === 'tenant-admin' ? 'tenant_admin' : 'tenant_user';
      await inviteUserAPI(tid, { email: userData.email, name: userData.name || '', role: backendRole });
      showToast('success', 'User invited', `${userData.email}`);
      await refreshMembers();
    } catch (err) {
      showToast('error', 'Error', err.response?.data?.error || 'Invite failed');
    }
  };

  const removeUser = async (memberId) => {
    const tid = user?.tenant?.id;
    if (!tid) return;
    try {
      await removeMemberAPI(tid, memberId);
      showToast('info', 'User removed', '');
      await refreshMembers();
    } catch (err) {
      showToast('error', 'Error', err.response?.data?.error || 'Remove failed');
    }
  };

  /* ── AUDIT (backend handles logging — addAudit is a no-op) ── */
  const addAudit = useCallback(() => {}, []);

  /* ── FIREWALL (local mock — no project_id available) ── */
  const addFWRule = () => {
    const id = 'fw' + Date.now();
    setFirewallRules(prev => [...prev, { id, direction: 'ingress', action: 'allow', protocol: 'tcp', port: '8080', source: '0.0.0.0/0', comment: 'Custom rule' }]);
    showToast('success', 'Rule added', 'allow tcp:8080 ingress');
  };
  const removeFWRule = (id) => {
    setFirewallRules(prev => prev.filter(r => r.id !== id));
    showToast('info', 'Rule removed', '');
  };

  /* ── SUPPORT SESSIONS (local mock) ── */
  const createSupportSession = (data) => {
    const t = tenants.find(x => x.id === data.tenantId);
    const tenantName = t ? t.name : data.tenantId;
    const session = {
      id: 'ss-' + String(supportSessions.length + 1).padStart(3, '0'),
      engineer: user?.full_name || 'Admin', tenant: tenantName,
      scope: data.scope, status: 'active',
      started: new Date().toLocaleTimeString('ru-RU').slice(0, 5),
      expires: new Date(Date.now() + 3600000).toLocaleTimeString('ru-RU').slice(0, 5),
      reason: data.reason || '',
    };
    setSupportSessions(prev => [session, ...prev]);
    return { session, tenantId: data.tenantId, tenantName };
  };

  const enterSupportMode = (tid, tenantName, scope) => {
    setInSupportMode(true); setSupportTenant(tid); setSupportScope(scope);
    showToast('warn', 'Support Mode', `Tenant: ${tenantName}`);
  };
  const exitSupportMode = () => {
    setSupportSessions(prev => prev.map((s, i) => i === 0 && s.status === 'active' ? { ...s, status: 'expired' } : s));
    setInSupportMode(false); setSupportTenant(null); setSupportScope(null);
    showToast('info', 'Session ended', '');
  };
  const endSupportSession = (sessionId) => {
    setSupportSessions(prev => prev.map(s => s.id === sessionId ? { ...s, status: 'expired' } : s));
    showToast('info', 'Session ended', sessionId);
  };

  /* ── REGISTRATION REQUESTS ── */
  const submitRegistration = async (data) => {
    try {
      await registerRequest({
        email: data.email, type: data.type || 'user',
        full_name: data.name || '', company_name: data.org || '',
        phone: data.phone || '', comment: data.comment || '',
        password: data.password, password2: data.password2,
      });
      showToast('success', 'Аккаунт создан', 'Теперь вы можете войти');
      return true;
    } catch (err) {
      const detail = err.response?.data;
      const msg = typeof detail === 'string' ? detail
        : detail?.email?.[0] || detail?.password2?.[0] || detail?.password?.[0]
          || detail?.error || detail?.detail || 'Ошибка регистрации';
      return msg;
    }
  };

  const processRequest = async (id, status) => {
    const req = registrationRequests.find(r => r.id === id);
    if (!req) return;
    try {
      if (status === 'approved') {
        if (req.type === 'user') {
          const firstTenant = tenants[0];
          if (!firstTenant) { showToast('error', 'Error', 'No tenants available'); return; }
          await approveUserRequest(id, {
            login: req.email, password: 'TempPass123!',
            role: 'tenant_user', tenant_id: firstTenant.id,
          });
        } else {
          const slug = (req.org || req.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30);
          await approveTenantRequest(id, {
            tenant_name: req.org || req.name, tenant_slug: slug,
            contact_email: req.email, vdc_name: 'default',
            cpu_limit: 10, ram_mb_limit: 20480, disk_gb_limit: 500, vm_limit: 5,
          });
        }
        showToast('success', 'Request approved', req.email);
      } else {
        await rejectRequestAPI(id, { decision_note: '' });
        showToast('warn', 'Request rejected', req.name);
      }
      await refreshRequests();
      if (status === 'approved') await refreshTenants();
    } catch (err) {
      showToast('error', 'Error', err.response?.data?.error || err.response?.data?.detail || 'Operation failed');
    }
  };

  const pendingRequestsCount = registrationRequests.filter(r => r.status === 'pending').length;

  return (
    <AppContext.Provider value={{
      user, role, loading, login, logout,
      tenants, setTenants, createTenant, toggleTenantStatus, updateQuota,
      vms, setVMs, getAllVMs, getMyVMs, createVM, vmAction,
      members, inviteUser, removeUser,
      users: {}, setUsers: () => {},
      firewallRules, addFWRule, removeFWRule,
      auditLog, addAudit, refreshAudit,
      supportSessions, setSupportSessions, createSupportSession, endSupportSession,
      inSupportMode, supportTenant, supportScope, enterSupportMode, exitSupportMode,
      proxmoxNodes,
      registrationRequests, submitRegistration, processRequest, pendingRequestsCount,
      toasts, showToast, dismissToast,
      flavors, osTemplates,
      refreshVMs, refreshTenants, refreshMembers,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
