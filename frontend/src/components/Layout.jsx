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
  const navItems = [
    ["overview", "Overview"],
    ["users", "Users"],
    ["train", "Training"],
    ["auth", "Authentication"],
    ["metrics", "Metrics"],
    ["logs", "Auth Logs"],
  ];

  return (
    <div className="shell">
      <header className="header">
        <div className="header-text">
          <h1>EEG Auth</h1>
          <p className="sub">CNN-based biometric authentication</p>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="btn btn-outline"
            onClick={onToggleTheme}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>
          <button type="button" className="btn btn-outline" onClick={onRefresh} disabled={busy}>
            {busy ? <Spinner /> : null}
            {busy ? "Syncing…" : "Refresh"}
          </button>
        </div>
      </header>

      <div className="app-layout">
        <aside className="sidebar">
          <nav className="sidebar-nav">
            {navItems.map(([key, label]) => (
              <button
                key={key}
                className={`nav-item${tab === key ? " nav-item-on" : ""}`}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="main-content">
          <div className={`notice ${notice.type}`} role="alert">
            {notice.text}
          </div>

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

          {children}

          <footer className="footer">
            EEG Auth v2
          </footer>
        </main>
      </div>
    </div>
  );
}


