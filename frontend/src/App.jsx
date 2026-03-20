import { useCallback, useEffect, useMemo, useState } from "react";
import {
  authenticateUser,
  deleteUser,
  getAuthLogs,
  getDashboard,
  getHealth,
  getMetrics,
  getModelStatus,
  getUsers,
  registerUser,
  trainModel,
} from "./api/client";
import Layout from "./components/Layout";
import OverviewTab from "./components/OverviewTab";
import UsersTab from "./components/UsersTab";
import TrainingTab from "./components/TrainingTab";
import AuthTab from "./components/AuthTab";
import MetricsTab from "./components/MetricsTab";
import LogsTab from "./components/LogsTab";

function pct(v) {
  return `${(Number(v || 0) * 100).toFixed(2)}%`;
}

export default function App() {
  const [tab, setTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("tab") || "overview";
  });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState({ type: "info", text: "Ready." });
  const [theme, setTheme] = useState("light");

  // Data
  const [health, setHealth] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [users, setUsers] = useState([]);
  const [modelStatus, setModelStatus] = useState(null);
  const [authLogs, setAuthLogs] = useState([]);
  const [authResult, setAuthResult] = useState(null);

  // Forms
  const [regForm, setRegForm] = useState({ username: "", subjectId: 1 });
  const [authForm, setAuthForm] = useState({
    username: "",
    subjectId: 1,
    threshold: 0.9,
    file: null,
  });
  const [metricsThreshold, setMetricsThreshold] = useState(0.9);
  const [metrics, setMetrics] = useState(null);

  // Inline validation errors
  const [regErrors, setRegErrors] = useState({});
  const [authErrors, setAuthErrors] = useState({});

  const notify = useCallback((type, text) => setNotice({ type, text }), []);

  // Stats cards
  const cards = useMemo(() => {
    const stats = dashboard?.auth_stats || {};
    return [
      { label: "Users", value: users.length },
      { label: "Model", value: health?.model_ready ? "Ready" : "—" },
      { label: "Files", value: health?.data_files ?? 0 },
      { label: "Success", value: pct(stats.success_rate || 0) },
      { label: "Auths", value: stats.total_attempts ?? 0 },
      { label: "Database", value: health?.db_available ? "On" : "Off" },
    ];
  }, [users, health, dashboard]);

  /* ---------- Refresh ---------- */

  const refresh = useCallback(async () => {
    setBusy(true);
    const errors = [];
    
    try {
      // Validate backend health first
      const h = await getHealth().catch(() => {
        throw new Error(
          `Backend unreachable. Make sure the backend is running at ${
            import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000"
          }`
        );
      });

      // Parallel fetch other data with individual error handling
      const results = await Promise.allSettled([
        getUsers(),
        getDashboard(),
        getModelStatus().catch(() => null),
        getAuthLogs().catch(() => []),
      ]);

      const [usersResult, dashboardResult, modelStatusResult, authLogsResult] =
        results;

      if (usersResult.status === "fulfilled") {
        setUsers(usersResult.value);
      } else {
        errors.push("Could not fetch users list");
      }

      if (dashboardResult.status === "fulfilled") {
        setDashboard(dashboardResult.value);
      } else {
        errors.push("Could not fetch dashboard data");
      }

      if (modelStatusResult.status === "fulfilled") {
        setModelStatus(modelStatusResult.value);
      } else {
        console.warn("Could not fetch model status");
      }

      if (authLogsResult.status === "fulfilled") {
        setAuthLogs(authLogsResult.value);
      } else {
        console.warn("Could not fetch auth logs");
      }

      setHealth(h);

      if (errors.length > 0) {
        notify("warning", `Partial sync: ${errors.join(", ")}`);
      } else {
        notify("success", "Synced.");
      }
    } catch (err) {
      const message =
        err?.response?.data?.detail ||
        err.message ||
        "API unreachable - backend may be starting up or not configured properly.";
      console.error("Refresh error:", err);
      notify("error", message);
    } finally {
      setBusy(false);
    }
  }, [notify]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Sync theme with body class for CSS variables
  useEffect(() => {
    if (theme === "dark") {
      document.body.classList.add("dark");
    } else {
      document.body.classList.remove("dark");
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  // Keep tab in URL for deep-linking
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (tab) {
      params.set("tab", tab);
    } else {
      params.delete("tab");
    }
    const newUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
    window.history.replaceState(null, "", newUrl);
  }, [tab]);

  /* ---------- User management ---------- */

  async function onRegister(e) {
    e.preventDefault();
    const errors = {};
    if (!regForm.username.trim()) {
      errors.username = "Username is required.";
    }
    const sid = Number(regForm.subjectId);
    if (!Number.isFinite(sid) || sid < 1 || sid > 999) {
      errors.subjectId = "Subject ID must be between 1 and 999.";
    }
    setRegErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setBusy(true);
    try {
      const res = await registerUser({
        username: regForm.username.trim(),
        subject_id: Number(regForm.subjectId),
      });
      notify(res.success ? "success" : "error", res.message);
      if (res.success) {
        setRegForm({ username: "", subjectId: 1 });
        await refresh();
      }
    } catch (err) {
      const msg = err?.response?.data?.detail || err.message || "Registration failed.";
      console.error("Registration error:", err);
      notify("error", msg);
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteUser(username) {
    if (!username?.trim()) return;
    setBusy(true);
    try {
      const res = await deleteUser(username.trim());
      notify(res.success ? "success" : "error", res.message);
      if (res.success) {
        await refresh();
      }
    } catch (err) {
      notify("error", err?.response?.data?.detail || "Delete failed.");
    } finally {
      setBusy(false);
    }
  }

  /* ---------- Training ---------- */

  async function onTrain() {
    setBusy(true);
    notify("info", "Training in progress — this may take a few minutes...");
    try {
      const res = await trainModel();
      notify(res.success ? "success" : "error", res.message);
      if (res.success) {
        await refresh();
      }
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err.message ||
        "Training failed - backend may be unreachable or still starting up.";
      console.error("Training error:", err);
      notify("error", msg);
    } finally {
      setBusy(false);
    }
  }

  /* ---------- Authentication ---------- */

  async function onAuth(e) {
    e.preventDefault();
    const errors = {};
    const sid = Number(authForm.subjectId);
    const thr = Number(authForm.threshold);
    if (!authForm.username.trim()) {
      errors.username = "Username is required.";
    }
    if (!Number.isFinite(sid) || sid < 1 || sid > 999) {
      errors.subjectId = "Subject ID must be between 1 and 999.";
    }
    if (!Number.isFinite(thr) || thr < 0 || thr > 1) {
      errors.threshold = "Threshold must be between 0.0 and 1.0 (e.g. 0.90).";
    }
    if (!authForm.file) {
      errors.file = "Please upload an EEG CSV file.";
    }
    setAuthErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setBusy(true);
    setAuthResult(null);
    try {
      const res = await authenticateUser({
        file: authForm.file,
        username: authForm.username.trim(),
        subjectId: Number(authForm.subjectId),
        threshold: Number(authForm.threshold),
      });
      setAuthResult(res);
      notify(res.success ? "success" : "error", res.message);
      if (res.success) {
        await refresh();
      }
    } catch (err) {
      const msg =
        err?.response?.data?.detail || err.message || "Authentication failed.";
      setAuthResult({ success: false, message: msg });
      console.error("Authentication error:", err);
      notify("error", msg);
    } finally {
      setBusy(false);
    }
  }

  /* ---------- Metrics ---------- */

  async function onMetrics() {
    setBusy(true);
    try {
      const data = await getMetrics(metricsThreshold);
      setMetrics(data);
      notify("success", `Metrics computed on ${data.sample_count} holdout samples.`);
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err.message ||
        "Metrics evaluation failed - ensure the model is trained.";
      console.error("Metrics error:", err);
      notify("error", msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Layout
      busy={busy}
      notice={notice}
      onRefresh={refresh}
      tab={tab}
      setTab={setTab}
      cards={cards}
      theme={theme}
      onToggleTheme={toggleTheme}
    >
      {tab === "overview" && (
        <OverviewTab
          health={health}
          dashboard={dashboard}
          users={users}
          modelStatus={modelStatus}
        />
      )}

      {tab === "users" && (
        <UsersTab
          users={users}
          busy={busy}
          regForm={regForm}
          setRegForm={setRegForm}
          regErrors={regErrors}
          onRegister={onRegister}
          onDeleteUser={onDeleteUser}
        />
      )}

      {tab === "train" && (
        <TrainingTab users={users} modelStatus={modelStatus} busy={busy} onTrain={onTrain} />
      )}

      {tab === "auth" && (
        <AuthTab
          authForm={authForm}
          setAuthForm={setAuthForm}
          busy={busy}
          authResult={authResult}
          authErrors={authErrors}
          onAuth={onAuth}
        />
      )}

      {tab === "metrics" && (
        <MetricsTab
          metricsThreshold={metricsThreshold}
          setMetricsThreshold={setMetricsThreshold}
          busy={busy}
          metrics={metrics}
          onMetrics={onMetrics}
        />
      )}

      {tab === "logs" && <LogsTab authLogs={authLogs} health={health} />}
    </Layout>
  );
}
