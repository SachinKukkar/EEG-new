import Badge from "./common/Badge";
import Spinner from "./common/Spinner";

export default function AuthTab({ authForm, setAuthForm, busy, authResult, authErrors, onAuth }) {
  return (
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
              {authErrors?.username && <span className="field-error">{authErrors.username}</span>}
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
              <span className="field-help">
                Must match the EEG file subject (e.g. <code>s02_ex06.csv</code> &rarr; Subject ID <code>2</code>).
              </span>
              {authErrors?.subjectId && <span className="field-error">{authErrors.subjectId}</span>}
            </label>
            <label>
              Confidence Threshold
              <div className="row-flex">
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  value={authForm.threshold}
                  onChange={(e) => setAuthForm((s) => ({ ...s, threshold: e.target.value }))}
                  style={{ width: 100 }}
                />
                <div className="chip-row">
                  {[0.8, 0.9, 0.95].map((val) => (
                    <button
                      key={val}
                      type="button"
                      className={`chip${
                        Number(authForm.threshold) === val ? " chip-active" : ""
                      }`}
                      onClick={() => setAuthForm((s) => ({ ...s, threshold: val }))}
                    >
                      {val.toFixed(2)}{val === 0.9 ? " (recommended)" : ""}
                    </button>
                  ))}
                </div>
              </div>
              <span className="field-help">
                Higher threshold = stricter authentication. 0.90 is a good balance for this model.
              </span>
              {authErrors?.threshold && <span className="field-error">{authErrors.threshold}</span>}
            </label>
            <label>
              EEG CSV File
              <input
                type="file"
                accept=".csv"
                onChange={(e) =>
                  setAuthForm((s) => ({ ...s, file: e.target.files?.[0] || null }))
                }
                required
              />
              <span className="field-help">
                Use files from <code>data/Filtered_Data/</code>, e.g. <code>s01_ex05.csv</code>.
              </span>
              {authErrors?.file && <span className="field-error">{authErrors.file}</span>}
            </label>
            <button className="btn" disabled={busy}>
              {busy ? (
                <>
                  <Spinner /> Verifying...
                </>
              ) : (
                "🔒 Authenticate"
              )}
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
                  <span>
                    User: <b>{authResult.data.username}</b>
                  </span>
                  <span>
                    Subject: <b>#{authResult.data.subject_id}</b>
                  </span>
                  <span>
                    Threshold: <b>{authResult.data.threshold}</b>
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="empty">No authentication attempted yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}


