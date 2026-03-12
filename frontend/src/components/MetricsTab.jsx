import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import Spinner from "./common/Spinner";

export default function MetricsTab({ metricsThreshold, setMetricsThreshold, busy, metrics, onMetrics }) {
  return (
    <section className="panel">
      <h2>🎯 Model Performance Analytics</h2>
      <p className="muted">
        Evaluated on a deterministic holdout set (last 20% of each user&apos;s EEG segments).
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
        <div className="chip-row">
          {[0.8, 0.9, 0.95].map((val) => (
            <button
              key={val}
              type="button"
              className={`chip${metricsThreshold === val ? " chip-active" : ""}`}
              onClick={() => setMetricsThreshold(val)}
            >
              {val.toFixed(2)}{val === 0.9 ? " (recommended)" : ""}
            </button>
          ))}
        </div>
        <button className="btn" onClick={onMetrics} disabled={busy}>
          {busy ? (
            <>
              <Spinner /> Computing...
            </>
          ) : (
            "📊 Evaluate Model"
          )}
        </button>
      </div>

      {!metrics && !busy && (
        <p className="empty">
          No evaluation yet. Choose a threshold and click <strong>Evaluate Model</strong> to see
          ROC curves, confusion matrix, and detailed metrics.
        </p>
      )}

      {!metrics && busy && (
        <>
          <div className="metrics-showcase">
            <div className="metric-card-large skeleton skeleton-card" />
            <div className="metric-card-large skeleton skeleton-card" />
          </div>
          <div className="chart-grid-2">
            <div className="chart-card skeleton skeleton-card" />
            <div className="chart-card skeleton skeleton-card" />
          </div>
        </>
      )}

      {metrics && (
        <>
          {/* Core metrics */}
          <h3>Core Metrics</h3>
          <p className="muted">
            Overall authentication performance on the holdout set at the selected threshold.
          </p>
          <div className="metrics-showcase">
            {[
              { label: "Accuracy", value: metrics.metrics.Accuracy, color: "#2E86DE", icon: "🎯" },
              { label: "Precision", value: metrics.metrics.Precision, color: "#10AC84", icon: "✓" },
              { label: "Recall", value: metrics.metrics.Recall, color: "#F39C12", icon: "📡" },
              {
                label: "F1 Score",
                value: metrics.metrics.F1_Score || metrics.metrics.F1,
                color: "#9B59B6",
                icon: "⚖️",
              },
            ].map((m) => (
              <div
                key={m.label}
                className="metric-card-large"
                style={{ borderLeft: `4px solid ${m.color}` }}
              >
                <div className="metric-icon">{m.icon}</div>
                <div className="metric-content">
                  <h3>{m.label}</h3>
                  <div className="metric-value-large">{(m.value * 100).toFixed(2)}%</div>
                  <div className="metric-bar">
                    <div
                      className="metric-bar-fill"
                      style={{ width: `${m.value * 100}%`, background: m.color }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ROC Curve & Confusion Matrix */}
          <h3>Discrimination & Classification</h3>
          <p className="muted">
            ROC curve shows trade-off between false positives and true positives; confusion matrix
            summarizes correct vs. incorrect decisions.
          </p>
          <div className="chart-grid-2">
            {/* ROC Curve */}
            <div className="chart-card">
              <h3>📈 ROC Curve (AUC = {(metrics.metrics.AUC || 0).toFixed(3)})</h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart
                  data={(() => {
                    const fpr = metrics.metrics.fpr || [];
                    const tpr = metrics.metrics.tpr || [];
                    return fpr.map((f, i) => ({ fpr: f, tpr: tpr[i] || 0 }));
                  })()}
                >
                  <defs>
                    <linearGradient id="rocGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2E86DE" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#2E86DE" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
                  <XAxis
                    dataKey="fpr"
                    label={{ value: "False Positive Rate", position: "insideBottom", offset: -5 }}
                  />
                  <YAxis
                    label={{ value: "True Positive Rate", angle: -90, position: "insideLeft" }}
                  />
                  <Tooltip formatter={(value) => value.toFixed(3)} />
                  <Area
                    type="monotone"
                    dataKey="tpr"
                    stroke="#2E86DE"
                    strokeWidth={3}
                    fill="url(#rocGradient)"
                  />
                  <Line
                    type="linear"
                    dataKey="fpr"
                    stroke="#E0E0E0"
                    strokeDasharray="5 5"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
              <div className="chart-footer">
                EER: <strong>{(metrics.metrics.EER * 100).toFixed(2)}%</strong> at threshold{" "}
                {(metrics.metrics.EER_Threshold || 0).toFixed(3)}
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
                    <div
                      className="cm-cell tn"
                      style={{
                        background: `rgba(46, 134, 222, ${Math.min(metrics.metrics.TN / 100, 0.8)})`,
                      }}
                    >
                      <div className="cm-value">{metrics.metrics.TN}</div>
                      <div className="cm-desc">True Negative</div>
                    </div>
                    <div
                      className="cm-cell fp"
                      style={{
                        background: `rgba(238, 90, 111, ${Math.min(metrics.metrics.FP / 50, 0.8)})`,
                      }}
                    >
                      <div className="cm-value">{metrics.metrics.FP}</div>
                      <div className="cm-desc">False Positive</div>
                    </div>
                    <div
                      className="cm-cell fn"
                      style={{
                        background: `rgba(238, 90, 111, ${Math.min(metrics.metrics.FN / 50, 0.8)})`,
                      }}
                    >
                      <div className="cm-value">{metrics.metrics.FN}</div>
                      <div className="cm-desc">False Negative</div>
                    </div>
                    <div
                      className="cm-cell tp"
                      style={{
                        background: `rgba(16, 172, 132, ${Math.min(metrics.metrics.TP / 100, 0.8)})`,
                      }}
                    >
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
          <h3>Error Rates & Balance</h3>
          <p className="muted">
            Error rates capture where the system fails, while the radar view summarizes all key
            metrics on a single chart.
          </p>
          <div className="chart-grid-2">
            {/* Error Rates Bar Chart */}
            <div className="chart-card">
              <h3>⚠️ Error Analysis</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={[
                    { name: "FAR", value: metrics.metrics.FAR * 100, fill: "#EE5A6F" },
                    { name: "FRR", value: metrics.metrics.FRR * 100, fill: "#2E86DE" },
                    { name: "EER", value: metrics.metrics.EER * 100, fill: "#9B59B6" },
                    {
                      name: "FPR",
                      value: (metrics.metrics.FPR || metrics.metrics.FAR) * 100,
                      fill: "#F39C12",
                    },
                    {
                      name: "FNR",
                      value: (metrics.metrics.FNR || metrics.metrics.FRR) * 100,
                      fill: "#E74C3C",
                    },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis label={{ value: "Rate (%)", angle: -90, position: "insideLeft" }} />
                  <Tooltip formatter={(value) => `${value.toFixed(3)}%`} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {[0, 1, 2, 3, 4].map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={["#EE5A6F", "#2E86DE", "#9B59B6", "#F39C12", "#E74C3C"][index]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Performance Radar */}
            <div className="chart-card">
              <h3>🎯 Performance Radar</h3>
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart
                  data={[
                    { metric: "Accuracy", value: metrics.metrics.Accuracy * 100 },
                    { metric: "Precision", value: metrics.metrics.Precision * 100 },
                    { metric: "Recall", value: metrics.metrics.Recall * 100 },
                    {
                      metric: "F1 Score",
                      value: (metrics.metrics.F1_Score || metrics.metrics.F1) * 100,
                    },
                    { metric: "Specificity", value: metrics.metrics.Specificity * 100 },
                    { metric: "AUC", value: (metrics.metrics.AUC || 0) * 100 },
                  ]}
                >
                  <PolarGrid stroke="#E0E0E0" />
                  <PolarAngleAxis dataKey="metric" />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} />
                  <Radar
                    name="Performance"
                    dataKey="value"
                    stroke="#2E86DE"
                    fill="#2E86DE"
                    fillOpacity={0.6}
                  />
                  <Tooltip formatter={(value) => `${value.toFixed(1)}%`} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Precision-Recall Curve & Additional Metrics */}
          <h3>Advanced Metrics</h3>
          <p className="muted">
            Precision–Recall focuses on positive predictions; advanced scores quantify robustness in
            imbalanced scenarios.
          </p>
          <div className="chart-grid-2">
            {/* Precision-Recall Curve */}
            <div className="chart-card">
              <h3>📊 Precision-Recall Curve</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart
                  data={(() => {
                    const precision = metrics.metrics.precision_curve || [];
                    const recall = metrics.metrics.recall_curve || [];
                    return recall.map((r, i) => ({ recall: r, precision: precision[i] || 0 }));
                  })()}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
                  <XAxis
                    dataKey="recall"
                    label={{ value: "Recall", position: "insideBottom", offset: -5 }}
                  />
                  <YAxis
                    label={{ value: "Precision", angle: -90, position: "insideLeft" }}
                  />
                  <Tooltip formatter={(value) => value.toFixed(3)} />
                  <Line
                    type="monotone"
                    dataKey="precision"
                    stroke="#10AC84"
                    strokeWidth={3}
                    dot={false}
                  />
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
                  <strong>
                    {((metrics.metrics.Balanced_Accuracy || 0) * 100).toFixed(2)}%
                  </strong>
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
                  <strong className="text-warn">
                    {((metrics.metrics.FDR || 0) * 100).toFixed(2)}%
                  </strong>
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
  );
}


