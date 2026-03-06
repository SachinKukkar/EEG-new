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
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, RadarChart, Radar, 
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, Cell, PieChart, Pie, RadialBarChart, RadialBar
} from "recharts";

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function pct(v) {
  return `${(Number(v || 0) * 100).toFixed(2)}%`;
}

function Spinner() {
  return <span className="spinner" aria-label="Loading" />;
}

function Badge({ ok }) {
  return (
    <span className={`badge ${ok ? "badge-ok" : "badge-fail"}`}>
      {ok ? "PASS" : "FAIL"}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  App                                                               */
/* ------------------------------------------------------------------ */

export default function App() {
  const [tab, setTab] = useState("overview");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState({ type: "info", text: "Platform ready." });

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

  /* ---------- User management ---------- */

  async function onRegister(e) {
    e.preventDefault();
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
    if (!authForm.file) {
      notify("error", "Upload an EEG CSV file first.");
      return;
    }
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

  /* ================================================================ */
  /*  Render                                                          */
  /* ================================================================ */

  const TABS = [
    ["overview", "Overview"],
    ["users", "Users"],
    ["train", "Training"],
    ["auth", "Authentication"],
    ["metrics", "Metrics"],
    ["logs", "Auth Logs"],
  ];

  return (
    <div className="shell">
      {/* ---------- Header ---------- */}
      <header className="header">
        <div className="header-text">
          <p className="eyebrow">EEG Biometric Platform</p>
          <h1>Authentication Console</h1>
          <p className="sub">Real EEG deep-learning biometric system &mdash; API v2.0</p>
        </div>
        <button className="btn btn-outline" onClick={refresh} disabled={busy}>
          {busy ? <Spinner /> : null}
          {busy ? " Syncing..." : "⟳ Refresh"}
        </button>
      </header>

      {/* ---------- Notice ---------- */}
      <div className={`notice ${notice.type}`} role="alert">{notice.text}</div>

      {/* ---------- Stats ---------- */}
      <section className="stats">
        {cards.map((c) => (
          <div key={c.label} className="stat">
            <span className="stat-icon">{c.icon}</span>
            <div>
              <p className="stat-label">{c.label}</p>
              <p className="stat-value">{c.value}</p>
            </div>
          </div>
        ))}
      </section>

      {/* ---------- Tabs ---------- */}
      <nav className="tabs">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            className={`tab${tab === key ? " tab-on" : ""}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* ========== Overview ========== */}
      {tab === "overview" && (
        <section className="panel">
          <h2>System Overview</h2>
          <div className="grid-2">
            <div className="kv-card">
              <span>API Status</span>
              <b className={health ? "text-ok" : "text-bad"}>
                {health ? "ONLINE" : "OFFLINE"}
              </b>
            </div>
            <div className="kv-card">
              <span>Model Trained</span>
              <b className={health?.model_ready ? "text-ok" : "text-bad"}>
                {health?.model_ready ? "YES" : "NO"}
              </b>
            </div>
            <div className="kv-card">
              <span>Model Size</span>
              <b>{modelStatus?.model_size_mb ?? "—"} MB</b>
            </div>
            <div className="kv-card">
              <span>Database</span>
              <b className={health?.db_available ? "text-ok" : "text-warn"}>
                {health?.db_available ? "Connected" : "Unavailable"}
              </b>
            </div>
            <div className="kv-card">
              <span>Total Auth Attempts</span>
              <b>{dashboard?.auth_stats?.total_attempts ?? 0}</b>
            </div>
            <div className="kv-card">
              <span>Avg Confidence</span>
              <b>{(dashboard?.auth_stats?.avg_confidence ?? 0).toFixed(4)}</b>
            </div>
          </div>

          {users.length > 0 && (
            <>
              <h3 style={{ marginTop: 20 }}>Registered Users</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Subject ID</th>
                      <th>Segments</th>
                      <th>Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.username}>
                        <td><strong>{u.username}</strong></td>
                        <td>{u.subject_id}</td>
                        <td>{u.data_segments}</td>
                        <td>
                          <span className={`dot ${u.data_exists ? "dot-ok" : "dot-bad"}`} />
                          {u.data_exists ? "Available" : "Missing"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}

      {/* ========== Users ========== */}
      {tab === "users" && (
        <section className="panel">
          <div className="split">
            {/* Register */}
            <div>
              <h2>Register New User</h2>
              <form onSubmit={onRegister} className="form">
                <label>
                  Username
                  <input
                    value={regForm.username}
                    onChange={(e) => setRegForm((s) => ({ ...s, username: e.target.value }))}
                    placeholder="e.g. alice"
                    required
                  />
                </label>
                <label>
                  Subject ID (matches CSV filename s##)
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={regForm.subjectId}
                    onChange={(e) => setRegForm((s) => ({ ...s, subjectId: e.target.value }))}
                    required
                  />
                </label>
                <button className="btn" disabled={busy}>
                  {busy ? <Spinner /> : null} Register
                </button>
              </form>

              <hr className="divider" />

              <h2>Remove User</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onDeleteUser(delUser);
                }}
                className="form"
              >
                <label>
                  Username
                  <input
                    value={delUser}
                    onChange={(e) => setDelUser(e.target.value)}
                    placeholder="Enter username to remove"
                    required
                  />
                </label>
                <button className="btn btn-danger" disabled={busy}>
                  {busy ? <Spinner /> : null} Delete User
                </button>
              </form>
            </div>

            {/* User list */}
            <div>
              <h2>Registered Users ({users.length})</h2>
              {users.length === 0 ? (
                <p className="empty">No users registered yet.</p>
              ) : (
                <div className="user-grid">
                  {users.map((u) => (
                    <div key={u.username} className="user-card">
                      <div className="user-card-head">
                        <span className="avatar">{u.username[0]?.toUpperCase()}</span>
                        <div>
                          <strong>{u.username}</strong>
                          <small>Subject #{u.subject_id}</small>
                        </div>
                      </div>
                      <div className="user-card-body">
                        <span>Segments: <b>{u.data_segments}</b></span>
                        <span>
                          Data: <b className={u.data_exists ? "text-ok" : "text-bad"}>
                            {u.data_exists ? "✓" : "✗"}
                          </b>
                        </span>
                      </div>
                      <button
                        className="btn btn-sm btn-danger"
                        disabled={busy}
                        onClick={() => onDeleteUser(u.username)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ========== Training ========== */}
      {tab === "train" && (
        <section className="panel">
          <h2>Model Training</h2>
          <p className="muted">
            Trains a CNN classifier on all registered users&#39; real EEG data stored in <code>assets/</code>.
            Requires at least <strong>2 registered users</strong>.
          </p>

          <div className="grid-2" style={{ marginBottom: 16 }}>
            <div className="kv-card">
              <span>Registered Users</span>
              <b>{users.length}</b>
            </div>
            <div className="kv-card">
              <span>Model Status</span>
              <b className={modelStatus?.trained ? "text-ok" : "text-warn"}>
                {modelStatus?.trained ? `Trained (${modelStatus.model_size_mb} MB)` : "Not Trained"}
              </b>
            </div>
          </div>

          {users.length < 2 && (
            <div className="notice warn" style={{ marginBottom: 12 }}>
              Register at least 2 users before training.
            </div>
          )}

          <button className="btn btn-lg" onClick={onTrain} disabled={busy || users.length < 2}>
            {busy ? <><Spinner /> Training...</> : "⚡ Start Training"}
          </button>
        </section>
      )}

      {/* ========== Authentication ========== */}
      {tab === "auth" && (
        <section className="panel">
          <div className="split">
            <div>
              <h2>Authenticate User</h2>
              <p className="muted">
                Upload a real EEG CSV file to verify a claimed identity using the trained model.
              </p>
              <form onSubmit={onAuth} className="form">
                <label>
                  Claimed Username
                  <input
                    value={authForm.username}
                    onChange={(e) => setAuthForm((s) => ({ ...s, username: e.target.value }))}
                    placeholder="e.g. alice"
                    required
                  />
                </label>
                <label>
                  Subject ID
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={authForm.subjectId}
                    onChange={(e) => setAuthForm((s) => ({ ...s, subjectId: e.target.value }))}
                    required
                  />
                </label>
                <label>
                  Confidence Threshold
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={authForm.threshold}
                    onChange={(e) => setAuthForm((s) => ({ ...s, threshold: e.target.value }))}
                  />
                </label>
                <label>
                  EEG CSV File
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setAuthForm((s) => ({ ...s, file: e.target.files?.[0] || null }))}
                    required
                  />
                </label>
                <button className="btn" disabled={busy}>
                  {busy ? <><Spinner /> Verifying...</> : "🔒 Authenticate"}
                </button>
              </form>
            </div>

            <div>
              <h2>Result</h2>
              {authResult ? (
                <div className={`result-card ${authResult.success ? "result-pass" : "result-fail"}`}>
                  <Badge ok={authResult.success} />
                  <p className="result-msg">{authResult.message}</p>
                  {authResult.data && (
                    <div className="result-meta">
                      <span>User: <b>{authResult.data.username}</b></span>
                      <span>Subject: <b>#{authResult.data.subject_id}</b></span>
                      <span>Threshold: <b>{authResult.data.threshold}</b></span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="empty">No authentication attempted yet.</p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ========== Metrics ========== */}
      {tab === "metrics" && (
        <section className="panel">
          <h2>🎯 Model Performance Analytics</h2>
          <p className="muted">
            Evaluated on a deterministic holdout set (last 20% of each user&#39;s EEG segments).
          </p>
          <div className="row-flex" style={{ marginBottom: 24 }}>
            <label className="inline-label">
              Confidence Threshold
              <input
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={metricsThreshold}
                onChange={(e) => setMetricsThreshold(Number(e.target.value))}
                style={{ width: 90 }}
              />
            </label>
            <button className="btn" onClick={onMetrics} disabled={busy}>
              {busy ? <><Spinner /> Computing...</> : "📊 Evaluate Model"}
            </button>
          </div>

          {metrics && (
            <>
              {/* Key Metrics Cards */}
              <div className="metrics-showcase">
                {[
                  { label: "Accuracy", value: metrics.metrics.Accuracy, color: "#2E86DE", icon: "🎯" },
                  { label: "Precision", value: metrics.metrics.Precision, color: "#10AC84", icon: "✓" },
                  { label: "Recall", value: metrics.metrics.Recall, color: "#F39C12", icon: "📡" },
                  { label: "F1 Score", value: metrics.metrics.F1_Score || metrics.metrics.F1, color: "#9B59B6", icon: "⚖️" },
                ].map((m) => (
                  <div key={m.label} className="metric-card-large" style={{ borderLeft: `4px solid ${m.color}` }}>
                    <div className="metric-icon">{m.icon}</div>
                    <div className="metric-content">
                      <h3>{m.label}</h3>
                      <div className="metric-value-large">{(m.value * 100).toFixed(2)}%</div>
                      <div className="metric-bar">
                        <div className="metric-bar-fill" style={{ width: `${m.value * 100}%`, background: m.color }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* ROC Curve & Confusion Matrix */}
              <div className="chart-grid-2">
                {/* ROC Curve */}
                <div className="chart-card">
                  <h3>📈 ROC Curve (AUC = {(metrics.metrics.AUC || 0).toFixed(3)})</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={(() => {
                      const fpr = metrics.metrics.fpr || [];
                      const tpr = metrics.metrics.tpr || [];
                      return fpr.map((f, i) => ({ fpr: f, tpr: tpr[i] || 0 }));
                    })()}>
                      <defs>
                        <linearGradient id="rocGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2E86DE" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#2E86DE" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
                      <XAxis dataKey="fpr" label={{ value: 'False Positive Rate', position: 'insideBottom', offset: -5 }} />
                      <YAxis label={{ value: 'True Positive Rate', angle: -90, position: 'insideLeft' }} />
                      <Tooltip formatter={(value) => value.toFixed(3)} />
                      <Area type="monotone" dataKey="tpr" stroke="#2E86DE" strokeWidth={3} fill="url(#rocGradient)" />
                      <Line type="linear" dataKey="fpr" stroke="#E0E0E0" strokeDasharray="5 5" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                  <div className="chart-footer">
                    EER: <strong>{(metrics.metrics.EER * 100).toFixed(2)}%</strong> at threshold {(metrics.metrics.EER_Threshold || 0).toFixed(3)}
                  </div>
                </div>

                {/* Confusion Matrix */}
                <div className="chart-card">
                  <h3>🔲 Confusion Matrix</h3>
                  <div className="confusion-matrix">
                    <div className="cm-labels">
                      <div className="cm-label-y">
                        <span>Actual Negative</span>
                        <span>Actual Positive</span>
                      </div>
                      <div className="cm-grid">
                        <div className="cm-cell tn" style={{ background: `rgba(46, 134, 222, ${Math.min(metrics.metrics.TN / 100, 0.8)})` }}>
                          <div className="cm-value">{metrics.metrics.TN}</div>
                          <div className="cm-desc">True Negative</div>
                        </div>
                        <div className="cm-cell fp" style={{ background: `rgba(238, 90, 111, ${Math.min(metrics.metrics.FP / 50, 0.8)})` }}>
                          <div className="cm-value">{metrics.metrics.FP}</div>
                          <div className="cm-desc">False Positive</div>
                        </div>
                        <div className="cm-cell fn" style={{ background: `rgba(238, 90, 111, ${Math.min(metrics.metrics.FN / 50, 0.8)})` }}>
                          <div className="cm-value">{metrics.metrics.FN}</div>
                          <div className="cm-desc">False Negative</div>
                        </div>
                        <div className="cm-cell tp" style={{ background: `rgba(16, 172, 132, ${Math.min(metrics.metrics.TP / 100, 0.8)})` }}>
                          <div className="cm-value">{metrics.metrics.TP}</div>
                          <div className="cm-desc">True Positive</div>
                        </div>
                      </div>
                      <div className="cm-label-x">
                        <span>Predicted Negative</span>
                        <span>Predicted Positive</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Error Rates & Performance Radar */}
              <div className="chart-grid-2">
                {/* Error Rates Bar Chart */}
                <div className="chart-card">
                  <h3>⚠️ Error Analysis</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={[
                      { name: 'FAR', value: metrics.metrics.FAR * 100, fill: '#EE5A6F' },
                      { name: 'FRR', value: metrics.metrics.FRR * 100, fill: '#2E86DE' },
                      { name: 'EER', value: metrics.metrics.EER * 100, fill: '#9B59B6' },
                      { name: 'FPR', value: (metrics.metrics.FPR || metrics.metrics.FAR) * 100, fill: '#F39C12' },
                      { name: 'FNR', value: (metrics.metrics.FNR || metrics.metrics.FRR) * 100, fill: '#E74C3C' },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis label={{ value: 'Rate (%)', angle: -90, position: 'insideLeft' }} />
                      <Tooltip formatter={(value) => `${value.toFixed(3)}%`} />
                      <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                        {[0,1,2,3,4].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={['#EE5A6F', '#2E86DE', '#9B59B6', '#F39C12', '#E74C3C'][index]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Performance Radar */}
                <div className="chart-card">
                  <h3>🎯 Performance Radar</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <RadarChart data={[
                      { metric: 'Accuracy', value: metrics.metrics.Accuracy * 100 },
                      { metric: 'Precision', value: metrics.metrics.Precision * 100 },
                      { metric: 'Recall', value: metrics.metrics.Recall * 100 },
                      { metric: 'F1 Score', value: (metrics.metrics.F1_Score || metrics.metrics.F1) * 100 },
                      { metric: 'Specificity', value: metrics.metrics.Specificity * 100 },
                      { metric: 'AUC', value: (metrics.metrics.AUC || 0) * 100 },
                    ]}>
                      <PolarGrid stroke="#E0E0E0" />
                      <PolarAngleAxis dataKey="metric" />
                      <PolarRadiusAxis angle={90} domain={[0, 100]} />
                      <Radar name="Performance" dataKey="value" stroke="#2E86DE" fill="#2E86DE" fillOpacity={0.6} />
                      <Tooltip formatter={(value) => `${value.toFixed(1)}%`} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Precision-Recall Curve & Additional Metrics */}
              <div className="chart-grid-2">
                {/* Precision-Recall Curve */}
                <div className="chart-card">
                  <h3>📊 Precision-Recall Curve</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={(() => {
                      const precision = metrics.metrics.precision_curve || [];
                      const recall = metrics.metrics.recall_curve || [];
                      return recall.map((r, i) => ({ recall: r, precision: precision[i] || 0 }));
                    })()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
                      <XAxis dataKey="recall" label={{ value: 'Recall', position: 'insideBottom', offset: -5 }} />
                      <YAxis label={{ value: 'Precision', angle: -90, position: 'insideLeft' }} />
                      <Tooltip formatter={(value) => value.toFixed(3)} />
                      <Line type="monotone" dataKey="precision" stroke="#10AC84" strokeWidth={3} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="chart-footer">
                    PR-AUC: <strong>{(metrics.metrics.PR_AUC || 0).toFixed(3)}</strong>
                  </div>
                </div>

                {/* Additional Metrics */}
                <div className="chart-card">
                  <h3>📋 Advanced Metrics</h3>
                  <div className="metric-table">
                    <div className="metric-row">
                      <span>Balanced Accuracy</span>
                      <strong>{((metrics.metrics.Balanced_Accuracy || 0) * 100).toFixed(2)}%</strong>
                    </div>
                    <div className="metric-row">
                      <span>G-Mean</span>
                      <strong>{((metrics.metrics.G_Mean || 0) * 100).toFixed(2)}%</strong>
                    </div>
                    <div className="metric-row">
                      <span>F2 Score</span>
                      <strong>{((metrics.metrics.F2_Score || 0) * 100).toFixed(2)}%</strong>
                    </div>
                    <div className="metric-row">
                      <span>NPV (Negative Predictive Value)</span>
                      <strong>{((metrics.metrics.NPV || 0) * 100).toFixed(2)}%</strong>
                    </div>
                    <div className="metric-row">
                      <span>FDR (False Discovery Rate)</span>
                      <strong className="text-warn">{((metrics.metrics.FDR || 0) * 100).toFixed(2)}%</strong>
                    </div>
                    <div className="metric-row">
                      <span>Specificity</span>
                      <strong>{((metrics.metrics.Specificity || 0) * 100).toFixed(2)}%</strong>
                    </div>
                    <div className="metric-row">
                      <span>Total Test Samples</span>
                      <strong>{metrics.sample_count}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      )}

      {/* ========== Auth Logs ========== */}
      {tab === "logs" && (
        <section className="panel">
          <h2>Authentication Logs</h2>
          {authLogs.length === 0 ? (
            <p className="empty">
              {health?.db_available
                ? "No authentication attempts logged yet."
                : "Database unavailable — logs require MySQL connection."}
            </p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Result</th>
                    <th>Confidence</th>
                    <th>Reason</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {authLogs.map((log, i) => (
                    <tr key={i}>
                      <td><strong>{log.username}</strong></td>
                      <td><Badge ok={log.success} /></td>
                      <td>{(log.confidence * 100).toFixed(1)}%</td>
                      <td className="wrap-cell">{log.reason}</td>
                      <td className="mono">{log.timestamp?.replace("T", " ").slice(0, 19)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ---------- Footer ---------- */}
      <footer className="footer">
        EEG Biometric Authentication System &mdash; Real Data Only &mdash; v2.0
      </footer>
    </div>
  );
}
