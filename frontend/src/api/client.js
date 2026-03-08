import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
const WS_BASE = BASE_URL.replace(/^http/, "ws");

// Axios instance — attach API key from env if present
export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 300_000, // 5 min for training
});

const API_KEY = import.meta.env.VITE_API_KEY || "";
if (API_KEY) {
  api.defaults.headers.common["X-API-Key"] = API_KEY;
}

/* ------------------------------------------------------------------ */
/*  Health / System                                                    */
/* ------------------------------------------------------------------ */
export async function getHealth() {
  const { data } = await api.get("/api/health");
  return data;
}

/* ------------------------------------------------------------------ */
/*  Users                                                              */
/* ------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------ */
/*  Model                                                              */
/* ------------------------------------------------------------------ */
export async function trainModel() {
  const { data } = await api.post("/api/model/train");
  return data;
}

export async function getModelStatus() {
  const { data } = await api.get("/api/model/status");
  return data;
}

/* ------------------------------------------------------------------ */
/*  Authentication — CSV upload                                        */
/* ------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------ */
/*  Authentication — Raw hardware data (REST)                          */
/* ------------------------------------------------------------------ */
/**
 * Authenticate using raw EEG data from hardware.
 *
 * @param {object} params
 * @param {number[][]} params.eegData  - 2-D array [T][4] (P4, Cz, F8, T7)
 * @param {string}     params.username
 * @param {number}     params.subjectId
 * @param {number}     [params.threshold=0.90]
 */
export async function authenticateRaw({ eegData, username, subjectId, threshold = 0.9 }) {
  const { data } = await api.post("/api/authenticate/raw", {
    eeg_data: eegData,
    username,
    subject_id: subjectId,
    threshold,
  });
  return data;
}

/* ------------------------------------------------------------------ */
/*  Authentication — WebSocket live streaming                          */
/* ------------------------------------------------------------------ */
/**
 * Create a WebSocket session for real-time hardware EEG streaming.
 *
 * Usage:
 *   const ws = createStreamSocket({ username, subjectId, threshold,
 *                                   onResult, onError, onReady });
 *   ws.sendChunk([[p4, cz, f8, t7], ...]);
 *   ws.predict();
 *   ws.close();
 */
export function createStreamSocket({ username, subjectId, threshold = 0.9, onResult, onError, onReady }) {
  const sock = new WebSocket(`${WS_BASE}/ws/stream`);

  sock.onopen = () => {
    sock.send(JSON.stringify({ type: "init", username, subject_id: subjectId, threshold }));
  };

  sock.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === "ready" && onReady) onReady(msg);
      else if (msg.type === "result" && onResult) onResult(msg);
      else if (msg.type === "error" && onError) onError(msg);
    } catch {
      if (onError) onError({ detail: "Invalid JSON from server" });
    }
  };

  sock.onerror = (e) => { if (onError) onError({ detail: "WebSocket error", raw: e }); };
  sock.onclose = () => {};

  return {
    /** Send a chunk of EEG samples [[p4,cz,f8,t7], ...] */
    sendChunk(samples) {
      if (sock.readyState === WebSocket.OPEN)
        sock.send(JSON.stringify({ type: "data", samples }));
    },
    /** Trigger prediction on the buffered data */
    predict() {
      if (sock.readyState === WebSocket.OPEN)
        sock.send(JSON.stringify({ type: "predict" }));
    },
    close() { sock.close(); },
  };
}

/* ------------------------------------------------------------------ */
/*  Dashboard / Logs / Metrics                                         */
/* ------------------------------------------------------------------ */
export async function getDashboard() {
  const { data } = await api.get("/api/dashboard");
  return data;
}

export async function getMetrics(threshold = 0.9) {
  const { data } = await api.get("/api/metrics", { params: { threshold } });
  return data;
}

export async function getAuthLogs(limit = 50) {
  const { data } = await api.get("/api/auth-logs", { params: { limit } });
  return data.logs;
}

