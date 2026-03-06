import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 180000,
});

export async function getHealth() {
  const { data } = await api.get("/api/health");
  return data;
}

export async function getUsers() {
  const { data } = await api.get("/api/users");
  return data.users;
}

export async function registerUser(payload) {
  const { data } = await api.post("/api/users/register", payload);
  return data;
}

export async function deleteUser(username) {
  const { data } = await api.delete(`/api/users/${encodeURIComponent(username)}`);
  return data;
}

export async function trainModel() {
  const { data } = await api.post("/api/model/train");
  return data;
}

export async function authenticateUser({ file, username, subjectId, threshold }) {
  const form = new FormData();
  form.append("file", file);
  form.append("username", username);
  form.append("subject_id", String(subjectId));
  form.append("threshold", String(threshold));

  const { data } = await api.post("/api/authenticate", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function getDashboard() {
  const { data } = await api.get("/api/dashboard");
  return data;
}

export async function getMetrics(threshold = 0.9) {
  const { data } = await api.get("/api/metrics", { params: { threshold } });
  return data;
}

export async function getModelStatus() {
  const { data } = await api.get("/api/model/status");
  return data;
}

export async function getAuthLogs(limit = 50) {
  const { data } = await api.get("/api/auth-logs", { params: { limit } });
  return data.logs;
}
