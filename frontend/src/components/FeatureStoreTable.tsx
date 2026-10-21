import { formatNumber, targetLabel } from "@/lib/format";
import { FEATURE_FIELDS, type WeatherFeature } from "@/types/mlops";

export function FeatureStoreTable({ rows }: { rows: WeatherFeature[] }) {
  return (
    <section className="ops-card p-6 md:p-8">
      <p className="kicker">Feature store</p>
      <h2 className="mt-2 text-2xl">Latest Open-Meteo rows</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/75">
        Last 10 days stored in weather_features for Puno. The target is 1 when the next day&apos;s
        precipitation is at least 1.0 mm. Today stays Pending until that next day exists.
      </p>
      {rows.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-ink/15 px-4 py-8 text-sm text-ink/70">
          No feature-store rows yet. The ingestion step upserts Open-Meteo history into Supabase.
        </p>
      ) : (
        <div className="table-shell mt-5">
          <table className="data-grid">
            <thead>
              <tr>
                <th>Date</th>
                {FEATURE_FIELDS.map((field) => (
                  <th key={field.key}>
                    {field.label} ({field.unit})
                  </th>
                ))}
                <th>Rain tomorrow</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.date}>
                  <td className="metric-value">{row.date}</td>
                  {FEATURE_FIELDS.map((field) => (
                    <td key={field.key} className="metric-value">
                      {formatNumber(row[field.key], field.digits)}
                    </td>
                  ))}
                  <td>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs ${
                        row.target_rain_tomorrow === null || row.target_rain_tomorrow === undefined
                          ? "border border-dashed border-ink/25 text-ink/55"
                          : Number(row.target_rain_tomorrow) === 1
                            ? "bg-lake/15 text-deep"
                            : "bg-ink/5 text-ink/70"
                      }`}
                    >
                      {targetLabel(row.target_rain_tomorrow)}
                    </span>
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
