import { useMemo } from "react";
import Spinner from "./common/Spinner";

export default function UsersTab({
  users,
  busy,
  regForm,
  setRegForm,
  regErrors,
  onRegister,
  onDeleteUser,
}) {
  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => a.username.localeCompare(b.username)),
    [users]
  );

  const letterSections = useMemo(() => {
    const map = new Map();
    for (const user of sortedUsers) {
      const first = (user.username?.[0] || "#").toUpperCase();
      const letter = /[A-Z]/.test(first) ? first : "#";
      if (!map.has(letter)) {
        map.set(letter, []);
      }
      map.get(letter).push(user);
    }
    return Array.from(map.entries());
  }, [sortedUsers]);

  return (
    <section className="panel">
      <div className="split">
        {/* Register */}
        <div className="users-register">
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
        </div>

        {/* User list */}
        <div className="users-list-area">
          <h2>Registered Users ({users.length})</h2>
          {users.length === 0 ? (
            <p className="empty">No users registered yet.</p>
          ) : (
            <>
              <div className="user-jump-nav" aria-label="Jump to users by first letter">
                {letterSections.map(([letter]) => (
                  <a key={letter} href={`#users-${letter}`} className="user-jump-link">
                    {letter}
                  </a>
                ))}
              </div>

              <div className="user-grid-scroll">
                <div className="user-grid">
                  {letterSections.map(([letter, letterUsers]) => (
                    <section key={letter} id={`users-${letter}`} className="user-letter-section">
                      <h3 className="user-letter-heading">{letter}</h3>
                      {letterUsers.map((u) => (
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
                              Data: <b className={u.data_exists ? "text-ok" : "text-bad"}>{u.data_exists ? "Available" : "Missing"}</b>
                            </span>
                          </div>
                          <button
                            className="btn btn-sm btn-danger"
                            disabled={busy}
                            onClick={() => onDeleteUser(u.username)}
                          >
                            {busy ? <Spinner /> : null} Delete User
                          </button>
                        </div>
                      ))}
                    </section>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}


