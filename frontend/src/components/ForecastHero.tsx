import { CloudRain, CloudSun, MapPin, Sprout } from "lucide-react";

import { formatLongDate, formatNumber, formatPercent, formatTimestamp } from "@/lib/format";
import { FEATURE_FIELDS, type DailyForecast } from "@/types/mlops";

export function ForecastHero({ forecast }: { forecast: DailyForecast | null }) {
  if (!forecast) {
    return (
      <section className="ops-card p-6 md:p-8">
        <p className="kicker">Business forecast</p>
        <h2 className="mt-2 text-2xl font-semibold">Tomorrow&apos;s Automated Weather Forecast</h2>
        <p className="mt-4 max-w-2xl text-reed-200/80">
          Awaiting the first automated forecast. The continuous-training workflow writes one row to
          daily_forecasts after each successful publication. This screen stays available while that
          row is still empty.
        </p>
      </section>
    );
  }

  const rainy = forecast.will_rain;
  const probability = Math.min(Math.max(forecast.rain_probability, 0), 1);

  return (
    <section className="ops-card overflow-hidden">
      <div className="grid gap-0 lg:grid-cols-[1.3fr_0.9fr]">
        <div className="p-6 md:p-8">
          <div className="flex flex-wrap items-center gap-3 text-sm text-reed-200/80">
            <MapPin className="h-4 w-4 text-reed-400" aria-hidden />
            <span>Puno, Peru · 15.8402° S, 70.0219° W · America/Lima</span>
          </div>
          <p className="kicker mt-5">Tomorrow&apos;s Automated Weather Forecast</p>
          <p className="mt-2 text-sm text-glacial-200/80">{formatLongDate(forecast.forecast_for_date)}</p>
          <div className="mt-5 flex items-start gap-4">
            {rainy ? (
              <CloudRain className="mt-1 h-12 w-12 shrink-0 text-sky-300" aria-hidden />
            ) : (
              <CloudSun className="mt-1 h-12 w-12 shrink-0 text-reed-400" aria-hidden />
            )}
            <div>
              <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
                {rainy ? "RAIN EXPECTED TOMORROW" : "CLEAR / DRY CONDITIONS EXPECTED"}
              </h2>
              <p className="mt-3 text-lg text-reed-200/90">
                Rain probability {formatPercent(probability)} · model {forecast.model_version}
              </p>
            </div>
          </div>
          <div className="mt-6">
            <div className="mb-2 flex justify-between text-sm text-reed-200/70">
              <span>Dry</span>
              <span>Rain</span>
            </div>
            <div className="bar-track" aria-hidden>
              <div className="bar-fill" style={{ width: `${probability * 100}%` }} />
            </div>
            <p className="sr-only">Rain probability {formatPercent(probability)}</p>
          </div>
          <div className="mt-6 flex gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
            <Sprout className="mt-0.5 h-5 w-5 shrink-0 text-glacial-400" aria-hidden />
            <p className="text-sm leading-6 md:text-base">
              {rainy
                ? "Automated Business Action: Activate agricultural irrigation hold & urban drainage alert"
                : "Normal agricultural & transport operations"}
            </p>
          </div>
          <p className="mt-4 text-xs uppercase tracking-[0.14em] text-reed-200/50">
            Stored {formatTimestamp(forecast.created_at)}
          </p>
        </div>
        <div className="border-t border-white/10 bg-black/15 p-6 md:p-8 lg:border-l lg:border-t-0">
          <p className="kicker">Today&apos;s seven drivers</p>
          <h3 className="mt-2 text-xl font-semibold">Features that produced this forecast</h3>
          <dl className="mt-5 space-y-3">
            {FEATURE_FIELDS.map((field) => (
              <div key={field.key} className="flex items-baseline justify-between gap-4 border-b border-white/5 pb-2">
                <dt className="text-sm text-reed-200/75">{field.label}</dt>
                <dd className="metric-value text-sm">
                  {formatNumber(forecast.input_features[field.key], field.digits)} {field.unit}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
