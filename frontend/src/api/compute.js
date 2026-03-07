import api from "./api";

export async function fetchVMs() {
  const { data } = await api.get("/vms/");
  return Array.isArray(data) ? data : data.results || [];
}

export async function createVMAPI(payload) {
  const { data } = await api.post("/vms/", payload);
  return data;
}

export async function deleteVMAPI(vmId) {
  await api.delete(`/vms/${vmId}/`);
}

export async function vmActionAPI(vmId, action) {
  const { data } = await api.post(`/vms/${vmId}/${action}/`);
  return data;
}

export async function fetchNodes() {
  const { data } = await api.get("/infrastructure/nodes/");
  return Array.isArray(data) ? data : data.results || [];
}

export async function fetchOSTemplates() {
  const { data } = await api.get("/os-templates/");
  return Array.isArray(data) ? data : data.results || [];
}

export async function fetchFlavors() {
  const { data } = await api.get("/flavors/");
  return Array.isArray(data) ? data : data.results || [];
}
