import Badge from "./common/Badge";

export default function LogsTab({ authLogs, health }) {
  return (
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
                  <td>
                    <strong>{log.username}</strong>
                  </td>
                  <td>
                    <Badge ok={log.success} />
                  </td>
                  <td>{(log.confidence * 100).toFixed(1)}%</td>
                  <td className="wrap-cell">{log.reason}</td>
                  <td className="mono">
                    {log.timestamp?.replace("T", " ").slice(0, 19)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}


