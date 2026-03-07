import api from "./api";

export async function loginAPI(email, password) {
  const { data } = await api.post("/auth/token/", { email, password });
  localStorage.setItem("access_token", data.access);
  localStorage.setItem("refresh_token", data.refresh);
  return data;
}

export async function fetchMe() {
  const { data } = await api.get("/auth/me/");
  return data;
}

export async function registerRequest(payload) {
  const { data } = await api.post("/auth/register/", payload);
  return data;
}

export async function resetPasswordConfirm(token, newPassword) {
  const { data } = await api.post("/auth/reset/confirm/", { token, new_password: newPassword });
  return data;
}

export function logoutCleanup() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}
