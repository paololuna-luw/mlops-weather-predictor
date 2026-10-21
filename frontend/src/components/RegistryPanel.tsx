import { Download } from "lucide-react";

import { formatNumber, formatTimestamp } from "@/lib/format";
import { FEATURE_FIELDS, type ModelRegistryRecord } from "@/types/mlops";

function MetricCard({ label, value, hint, ratio }: { label: string; value: string; hint: string; ratio?: number | null }) {
  return (
    <article className="rounded-2xl border border-ink/10 bg-white/40 p-4">
      <p className="text-xs text-ink/60">{label}</p>
      <p className="metric-value mt-3 text-3xl">{value}</p>
      {typeof ratio === "number" && Number.isFinite(ratio) ? (
        <div className="bar-track mt-3">
          <div className="bar-fill" style={{ width: `${Math.min(Math.max(ratio, 0), 1) * 100}%` }} />
        </div>
      ) : null}
      <p className="mt-2 text-xs text-ink/55">{hint}</p>
    </article>
  );
}

function cell(matrix: number[][] | null, row: number, column: number): number | null {
  const value = matrix?.[row]?.[column];
  return typeof value === "number" ? value : null;
}

export function RegistryPanel({
  active,
  history,
}: {
  active: ModelRegistryRecord | null;
  history: ModelRegistryRecord[];
}) {
  if (!active) {
    return (
      <section className="ops-card p-6 md:p-8">
        <p className="kicker">Model registry</p>
        <h2 className="mt-2 text-2xl">No production model yet</h2>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-ink/75">
          Run the GitHub Action &quot;MLOps Continuous Training &amp; Deployment Pipeline&quot;. It
          ingests Open-Meteo, passes pytest, fits GridSearchCV, and inserts the new active row
          before archiving the previous one.
        </p>
      </section>
    );
  }

  const weights = active.model_weights;
  const maxCoefficient = Math.max(...(weights?.coefficients.map((value) => Math.abs(value)) ?? [1]), 0.0001);
  const matrix = active.confusion_matrix;
  const cells = [
    { label: "True negatives", detail: "Actual dry, predicted dry", value: cell(matrix, 0, 0), tone: "bg-lake/10" },
    { label: "False positives", detail: "Actual dry, predicted rain", value: cell(matrix, 0, 1), tone: "bg-totora/10" },
    { label: "False negatives", detail: "Actual rain, predicted dry", value: cell(matrix, 1, 0), tone: "bg-totora/20" },
    { label: "True positives", detail: "Actual rain, predicted rain", value: cell(matrix, 1, 1), tone: "bg-lake/20" },
  ];

  return (
    <div className="space-y-6">
      <section className="ops-card p-6 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="kicker">Production model</p>
            <h2 className="mt-2 text-2xl">Evaluation metrics and confusion matrix</h2>
            <p className="mt-2 text-sm text-ink/70">
              {active.algorithm} · {active.version} · trained {formatTimestamp(active.created_at)}
            </p>
          </div>
          {active.storage_path ? (
            <a
              className="inline-flex items-center gap-2 rounded-full border border-lake/50 px-4 py-2 text-sm text-ink hover:bg-lake/5"
              href={active.storage_path}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Download className="h-4 w-4" aria-hidden />
              Download .joblib Model Artifact
            </a>
          ) : (
            <span className="text-sm text-ink/60">Artifact URL pending</span>
          )}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Accuracy"
            value={formatNumber(active.accuracy, 3)}
            hint="Hold-out classification accuracy"
            ratio={active.accuracy}
          />
          <MetricCard
            label="F1-Score (Optimization Target)"
            value={formatNumber(active.f1_score, 3)}
            hint="GridSearchCV scoring = f1"
            ratio={active.f1_score}
          />
          <MetricCard
            label="ROC-AUC"
            value={formatNumber(active.roc_auc, 3)}
            hint="Ranking quality on the hold-out set"
            ratio={active.roc_auc}
          />
          <MetricCard
            label="Training Dataset Size (Days)"
            value={active.dataset_rows === null ? "—" : String(active.dataset_rows)}
            hint="Labeled daily rows in the 80/20 split"
          />
        </div>

        <div className="mt-6">
          <h3 className="text-lg">Confusion matrix · [[TN, FP], [FN, TP]]</h3>
          {matrix ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {cells.map((item) => (
                <article key={item.label} className={`rounded-2xl border border-ink/10 p-4 ${item.tone}`}>
                  <p className="text-sm text-ink/70">{item.label}</p>
                  <p className="metric-value mt-2 text-3xl">{item.value ?? "—"}</p>
                  <p className="mt-1 text-xs text-ink/55">{item.detail}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-ink/70">The active row has no confusion matrix yet.</p>
          )}
        </div>
      </section>

      <section className="ops-card p-6 md:p-8">
        <p className="kicker">GridSearchCV</p>
        <h2 className="mt-2 text-2xl">Optimized hyperparameters and model weights</h2>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <pre className="metric-value overflow-x-auto rounded-2xl border border-ink/10 bg-white/40 p-4 text-xs leading-6 text-deep">
            {JSON.stringify(active.best_hyperparameters ?? {}, null, 2)}
          </pre>
          <div>
            {weights ? (
              <ul className="space-y-3">
                {weights.coefficients.map((coefficient, index) => {
                  const name = weights.feature_names[index] ?? FEATURE_FIELDS[index]?.key ?? `feature_${index}`;
                  const field = FEATURE_FIELDS.find((item) => item.key === name);
                  const width = Math.max(6, (Math.abs(coefficient) / maxCoefficient) * 100);
                  return (
                    <li key={name}>
                      <div className="mb-1 flex justify-between gap-3 text-sm">
                        <span>{field?.label ?? name}</span>
                        <span className="metric-value">{coefficient.toFixed(4)}</span>
                      </div>
                      <div className="bar-track">
                        <div
                          className="bar-fill"
                          style={{
                            width: `${width}%`,
                            background:
                              coefficient >= 0
                                ? "linear-gradient(90deg, #7fb4ff, #4c7fe6)"
                                : "linear-gradient(90deg, #c9b8ea, #7b5fc0)",
                          }}
                        />
                      </div>
                    </li>
                  );
                })}
                <li className="flex justify-between border-t border-ink/10 pt-3 text-sm">
                  <span>Intercept</span>
                  <span className="metric-value">{weights.intercept.toFixed(4)}</span>
                </li>
                <li className="flex justify-between text-sm">
                  <span>Decision threshold</span>
                  <span className="metric-value">{weights.threshold.toFixed(2)}</span>
                </li>
              </ul>
            ) : (
              <p className="text-sm text-ink/70">model_weights are missing on the active row.</p>
            )}
          </div>
        </div>
      </section>

      <section className="ops-card p-6 md:p-8">
        <p className="kicker">Lineage</p>
        <h2 className="mt-2 text-2xl">Model lineage and continuous training history</h2>
        {history.length === 0 ? (
          <p className="mt-4 text-sm text-ink/70">The registry history is empty.</p>
        ) : (
          <div className="table-shell mt-5">
            <table className="data-grid">
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Trained</th>
                  <th>Algorithm</th>
                  <th>F1-Score</th>
                  <th>ROC-AUC</th>
                  <th>Rows</th>
                  <th>State</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={`${row.id}-${row.version}`}>
                    <td className="metric-value">{row.version}</td>
                    <td>{formatTimestamp(row.created_at)}</td>
                    <td>{row.algorithm}</td>
                    <td className="metric-value">{formatNumber(row.f1_score, 3)}</td>
                    <td className="metric-value">{formatNumber(row.roc_auc, 3)}</td>
                    <td className="metric-value">{row.dataset_rows ?? "—"}</td>
                    <td>
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${
                          row.is_active ? "bg-lake/15 text-deep" : "bg-ink/5 text-ink/70"
                        }`}
                      >
                        {row.is_active ? "Active" : "Archived"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
