import { CloudRain, CloudSun, MapPin, Sprout } from "lucide-react";

import { DetailsToggle } from "@/components/DetailsToggle";
import { formatLongDate, formatNumber, formatPercent, formatTimestamp } from "@/lib/format";
import { FEATURE_FIELDS, type DailyForecast } from "@/types/mlops";

function Mountains() {
  return (
    <svg
      className="pointer-events-none absolute inset-x-0 bottom-0 h-24 w-full md:h-28"
      viewBox="0 0 400 120"
      preserveAspectRatio="none"
      aria-hidden
    >
      <polygon points="0,120 0,70 70,30 130,75 200,20 280,80 340,45 400,85 400,120" fill="#5b8fd0" />
      <polygon points="200,20 280,80 232,80" fill="#3a5cba" opacity="0.35" />
      <polygon points="70,30 130,75 86,75" fill="#3a5cba" opacity="0.35" />
      <polygon points="200,20 215,38 200,34 188,40" fill="#e8eef9" opacity="0.85" />
      <polygon points="70,30 82,46 70,42 60,48" fill="#e8eef9" opacity="0.85" />
      <polygon points="0,120 0,95 90,55 170,100 250,60 330,100 400,75 400,120" fill="#b9cbe6" />
      <polygon points="250,60 330,100 280,100" fill="#a3b9d9" opacity="0.8" />
      <polygon points="0,120 0,106 400,106 400,120" fill="#f1f3fa" />
    </svg>
  );
}

export function ForecastHero({ forecast }: { forecast: DailyForecast | null }) {
  if (!forecast) {
    return (
      <section className="ops-card p-6 md:p-8">
        <p className="kicker">Business forecast</p>
        <h2 className="mt-2 text-2xl">Tomorrow&apos;s Automated Weather Forecast</h2>
        <p className="mt-4 max-w-2xl text-ink/75">
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
    <section className="ops-card no-accent overflow-hidden">
      <div
        className="relative px-6 pb-24 pt-6 text-white md:px-10 md:pb-28 md:pt-7"
        style={{ background: "linear-gradient(160deg, #5a7fd0 0%, #3f5a99 100%)" }}
      >
        <div className="flex flex-wrap items-center gap-2 text-sm text-white/90">
          <MapPin className="h-4 w-4" aria-hidden />
          <span>Puno, Peru · 15.8402° S, 70.0219° W · America/Lima</span>
        </div>
        <p className="mt-6 text-sm text-white/90">Tomorrow&apos;s Automated Weather Forecast</p>
        <p className="text-lg font-light">{formatLongDate(forecast.forecast_for_date)}</p>
        <div className="forecast-reveal mt-4 flex items-center gap-4">
          {rainy ? (
            <CloudRain className="h-14 w-14 shrink-0" aria-hidden />
          ) : (
            <CloudSun className="h-14 w-14 shrink-0" aria-hidden />
          )}
          <h2 className="text-3xl md:text-4xl">
            {rainy ? "RAIN EXPECTED TOMORROW" : "CLEAR / DRY CONDITIONS EXPECTED"}
          </h2>
        </div>
        <p className="forecast-reveal mt-4 text-5xl font-light md:text-6xl">{formatPercent(probability)}</p>
        <p className="mt-1 text-sm text-white/90">Rain probability · model {forecast.model_version}</p>
        <div className="mt-4 max-w-md">
          <div className="mb-1.5 flex justify-between text-xs text-white/85">
            <span>Dry</span>
            <span>Rain</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/25" aria-hidden>
            <div className="prob-fill h-full rounded-full bg-white" style={{ width: `${probability * 100}%` }} />
          </div>
          <p className="sr-only">Rain probability {formatPercent(probability)}</p>
        </div>
        <Mountains />
      </div>

      <div className="p-6 md:p-8">
        <div className="flex gap-3 rounded-2xl bg-mist p-4">
          <Sprout className="mt-0.5 h-5 w-5 shrink-0 text-lake" aria-hidden />
          <p className="text-sm leading-6 md:text-base">
            {rainy
              ? "Hold irrigation and watch city drains. Rain is the likely call."
              : "Normal agricultural and transport operations."}
          </p>
        </div>
        <p className="mt-3 text-xs text-ink/55">Stored {formatTimestamp(forecast.created_at)}</p>
        <DetailsToggle label="Today's seven weather numbers">
          <dl className="grid gap-2 sm:grid-cols-2">
            {FEATURE_FIELDS.map((field) => (
              <div key={field.key} className="flex items-baseline justify-between gap-4 border-b border-ink/5 pb-2">
                <dt className="text-sm text-ink/75">{field.label}</dt>
                <dd className="metric-value text-sm">
                  {formatNumber(forecast.input_features[field.key], field.digits)} {field.unit}
                </dd>
              </div>
            ))}
          </dl>
        </DetailsToggle>
      </div>
    </section>
  );
}
