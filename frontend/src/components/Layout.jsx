import Spinner from "./common/Spinner";

export default function Layout({
  busy,
  notice,
  onRefresh,
  tab,
  setTab,
  cards,
  theme,
  onToggleTheme,
  children,
}) {
  return (
    <div className="shell">
      {/* ---------- Header ---------- */}
      <header className="header">
        <div className="header-text">
          <p className="eyebrow">EEG Biometric Platform</p>
          <h1>Authentication Console</h1>
          <p className="sub">Real EEG deep-learning biometric system &mdash; API v2.0</p>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="btn btn-outline"
            onClick={onToggleTheme}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? "☀ Light" : "🌙 Dark"}
          </button>
          <button type="button" className="btn btn-outline" onClick={onRefresh} disabled={busy}>
            {busy ? <Spinner /> : null}
            {busy ? " Syncing..." : "⟳ Refresh"}
          </button>
        </div>
      </header>

      {/* ---------- Notice ---------- */}
      <div className={`notice ${notice.type}`} role="alert">
        {notice.text}
      </div>

      {/* ---------- Tabs (top nav) ---------- */}
      <nav className="tabs">
        {[
          ["overview", "Overview"],
          ["users", "Users"],
          ["train", "Training"],
          ["auth", "Authentication"],
          ["metrics", "Metrics"],
          ["logs", "Auth Logs"],
        ].map(([key, label]) => (
          <button
            key={key}
            className={`tab${tab === key ? " tab-on" : ""}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* ---------- Stats row ---------- */}
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

      {/* ---------- Active tab content ---------- */}
      {children}

      {/* ---------- Footer ---------- */}
      <footer className="footer">
        EEG Biometric Authentication System &mdash; Real Data Only &mdash; v2.0
      </footer>
    </div>
  );
}


