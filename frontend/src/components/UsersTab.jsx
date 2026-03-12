import Spinner from "./common/Spinner";

export default function UsersTab({
  users,
  busy,
  regForm,
  setRegForm,
  regErrors,
  delUser,
  setDelUser,
  onRegister,
  onDeleteUser,
}) {
  return (
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
              {regErrors?.username && <span className="field-error">{regErrors.username}</span>}
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
              <span className="field-help">
                From EEG filenames like <code>s01_ex05.csv</code> &rarr; Subject ID is <code>1</code>.
              </span>
              {regErrors?.subjectId && <span className="field-error">{regErrors.subjectId}</span>}
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
                    <span>
                      Segments: <b>{u.data_segments}</b>
                    </span>
                    <span>
                      Data:{" "}
                      <b className={u.data_exists ? "text-ok" : "text-bad"}>
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
  );
}


