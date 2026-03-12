export default function OverviewTab({ health, dashboard, users, modelStatus }) {
  return (
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
            <table className="users-table">
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
                    <td>
                      <strong>{u.username}</strong>
                    </td>
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
  );
}


