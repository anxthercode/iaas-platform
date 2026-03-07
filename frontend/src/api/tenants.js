import api from "./api";

export async function fetchTenants() {
  const { data } = await api.get("/tenants/");
  return Array.isArray(data) ? data : data.results || [];
}

export async function fetchTenantDetail(tenantId) {
  const { data } = await api.get(`/tenants/${tenantId}/`);
  return data;
}

export async function updateQuotaAPI(tenantId, quotaData) {
  const { data } = await api.patch(`/tenants/${tenantId}/quota/`, quotaData);
  return data;
}

export async function suspendTenantAPI(tenantId) {
  const { data } = await api.post(`/tenants/${tenantId}/suspend/`);
  return data;
}

export async function resumeTenantAPI(tenantId) {
  const { data } = await api.post(`/tenants/${tenantId}/resume/`);
  return data;
}

export async function fetchMembers(tenantId) {
  const { data } = await api.get(`/tenants/${tenantId}/members/`);
  return Array.isArray(data) ? data : data.results || [];
}

export async function inviteUserAPI(tenantId, payload) {
  const { data } = await api.post(`/tenants/${tenantId}/invite/`, payload);
  return data;
}

export async function removeMemberAPI(tenantId, memberPk) {
  await api.delete(`/tenants/${tenantId}/members/${memberPk}/`);
}

export async function fetchAuditLog(params = {}) {
  const { data } = await api.get("/audit/", { params });
  return Array.isArray(data) ? data : data.results || [];
}

export async function fetchTenantAudit(tenantId) {
  const { data } = await api.get(`/tenants/${tenantId}/audit/`);
  return Array.isArray(data) ? data : data.results || [];
}

export async function fetchRegistrationRequests(params = {}) {
  const { data } = await api.get("/admin/registration-requests/", { params });
  return Array.isArray(data) ? data : data.results || [];
}

export async function approveUserRequest(reqId, body) {
  const { data } = await api.post(`/admin/registration-requests/${reqId}/approve-user/`, body);
  return data;
}

export async function approveTenantRequest(reqId, body) {
  const { data } = await api.post(`/admin/registration-requests/${reqId}/approve-tenant/`, body);
  return data;
}

export async function rejectRequestAPI(reqId, body = {}) {
  const { data } = await api.post(`/admin/registration-requests/${reqId}/reject/`, body);
  return data;
}

export async function adminCreateTenantAPI(payload) {
  const { data } = await api.post('/admin/tenants/create/', payload);
  return data;
}
