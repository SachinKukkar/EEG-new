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
  const [notice, setNotice] = useState({ type: "info", text: "Platform ready." });
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
  const [delUser, setDelUser] = useState("");
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
      { icon: "👤", label: "Users", value: users.length },
      { icon: "🧠", label: "Model", value: health?.model_ready ? "Ready" : "Not Trained" },
      { icon: "📁", label: "CSV Files", value: health?.data_files ?? 0 },
      { icon: "✅", label: "Success Rate", value: pct(stats.success_rate || 0) },
      { icon: "📊", label: "Total Auths", value: stats.total_attempts ?? 0 },
      { icon: "🗄️", label: "Database", value: health?.db_available ? "Online" : "Offline" },
    ];
  }, [users, health, dashboard]);

  /* ---------- Refresh ---------- */

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const [h, u, d, ms, logs] = await Promise.all([
        getHealth(),
        getUsers(),
        getDashboard(),
        getModelStatus().catch(() => null),
        getAuthLogs().catch(() => []),
      ]);
      setHealth(h);
      setUsers(u);
      setDashboard(d);
      setModelStatus(ms);
      setAuthLogs(logs);
      notify("success", "Data synchronized from API.");
    } catch (err) {
      notify("error", err?.response?.data?.detail || err.message || "API unreachable.");
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
      notify("error", err?.response?.data?.detail || "Registration failed.");
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
        setDelUser("");
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
      await refresh();
    } catch (err) {
      notify("error", err?.response?.data?.detail || "Training failed.");
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
      await refresh();
    } catch (err) {
      const msg = err?.response?.data?.detail || "Authentication failed.";
      setAuthResult({ success: false, message: msg });
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
      notify("error", err?.response?.data?.detail || "Metrics evaluation failed.");
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
          delUser={delUser}
          setDelUser={setDelUser}
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
