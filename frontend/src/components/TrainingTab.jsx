import Spinner from "./common/Spinner";

export default function TrainingTab({ users, modelStatus, busy, onTrain }) {
  return (
    <section className="panel">
      <h2>Model Training</h2>
      <p className="muted">
        Trains a CNN classifier on all registered users&apos; real EEG data stored in <code>assets/</code>.
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
        {busy ? (
          <>
            <Spinner /> Training...
          </>
        ) : (
          "⚡ Start Training"
        )}
      </button>
    </section>
  );
}


