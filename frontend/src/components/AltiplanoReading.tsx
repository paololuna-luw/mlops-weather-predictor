import { Snowflake, Sun, Thermometer, Wind } from "lucide-react";

import { formatNumber, formatPercent } from "@/lib/format";
import { isModelWeights, predictFromWeights } from "@/lib/modelEngine";
import {
  FEATURE_FIELDS,
  FEATURE_NAMES,
  type DailyForecast,
  type ModelRegistryRecord,
  type PredictionRequest,
} from "@/types/mlops";

function likelihood(p: number): string {
  if (p < 0.25) return "Unlikely";
  if (p < 0.5) return "Possible, but below the rain threshold";
  if (p < 0.75) return "Likely";
  return "Very likely";
}

function frost(min: number): string {
  if (min <= 0) return "Frost likely, protect crops";
  if (min <= 4) return "Cold night, light frost possible";
  return "Mild night for the altiplano";
}

function wind(kmh: number): string {
  if (kmh < 15) return "Calm";
  if (kmh < 30) return "Breezy";
  return "Strong, expect rough shores on the lake";
}

function sun(mj: number): string {
  if (mj < 12) return "Mostly overcast";
  if (mj < 22) return "Partly sunny";
  return "Intense sun, high-altitude UV";
}

export function AltiplanoReading({
  forecast,
  active,
}: {
  forecast: DailyForecast | null;
  active: ModelRegistryRecord | null;
}) {
  if (!forecast) return null;

  const input = forecast.input_features;
  const complete = FEATURE_NAMES.every((name) => typeof input[name] === "number" && Number.isFinite(input[name]));
  const full = complete ? (input as PredictionRequest) : null;
  const p = Math.min(Math.max(forecast.rain_probability, 0), 1);

  const weights = active?.model_weights;
  const drivers =
    full && weights && isModelWeights(weights)
      ? predictFromWeights(full, weights)
          .impacts.slice()
          .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
          .slice(0, 3)
      : [];

  const tmin = full?.temperature_2m_min ?? 0;
  const tmax = full?.temperature_2m_max ?? 0;

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <section className="ops-card p-6 md:p-8">
        <h3 className="text-xl">What this forecast predicts</h3>
        <p className="mt-3 text-sm leading-6 text-ink/75">
          The chance that Puno records <strong className="font-bold">1.0 mm of rain or more</strong> tomorrow.
          Rain is called when that chance reaches 50%.
        </p>
        <div className="mt-5">
          <div className="relative h-2.5 rounded-full bg-ink/10">
            <div className="h-full rounded-full bg-lake" style={{ width: `${p * 100}%` }} />
            <span className="absolute -top-1 left-1/2 w-0.5 -translate-x-1/2 bg-ink/50" style={{ height: "1.15rem" }} aria-hidden />
          </div>
          <div className="mt-2 flex justify-between text-xs text-ink/55">
            <span>0%</span>
            <span>50% threshold</span>
            <span>100%</span>
          </div>
          <p className="mt-3 text-sm">
            <span className="metric-value text-lg">{formatPercent(p)}</span> · {likelihood(p)}
          </p>
        </div>
        {drivers.length > 0 ? (
          <div className="mt-6">
            <h4 className="text-base">What pushed it most</h4>
            <ul className="mt-3 space-y-2 text-sm">
              {drivers.map((item) => {
                const field = FEATURE_FIELDS.find((f) => f.key === item.feature);
                return (
                  <li key={item.feature} className="flex justify-between gap-4 border-b border-ink/5 pb-2">
                    <span>{field?.label ?? item.feature}</span>
                    <span className={item.impact >= 0 ? "text-lake" : "text-totora"}>
                      {item.impact >= 0 ? "toward rain" : "toward dry"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </section>

      {full ? (
        <section className="ops-card p-6 md:p-8">
          <h3 className="text-xl">Altiplano today</h3>
          <p className="mt-1 text-sm text-ink/60">Today&apos;s readings in Puno, the base of tomorrow&apos;s forecast</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              { icon: Snowflake, label: "Night low", value: `${formatNumber(tmin, 1)} °C`, note: frost(tmin) },
              { icon: Thermometer, label: "Day–night swing", value: `${formatNumber(tmax - tmin, 1)} °C`, note: "Wide swings are typical at 3,800 m" },
              { icon: Wind, label: "Peak wind", value: `${formatNumber((full?.wind_speed_10m_max ?? 0), 0)} km/h`, note: wind((full?.wind_speed_10m_max ?? 0)) },
              { icon: Sun, label: "Solar radiation", value: `${formatNumber((full?.shortwave_radiation_sum ?? 0), 1)} MJ/m²`, note: sun((full?.shortwave_radiation_sum ?? 0)) },
            ].map(({ icon: Icon, label, value, note }) => (
              <article key={label} className="rounded-2xl bg-white/40 p-4">
                <p className="flex items-center gap-2 text-sm text-ink/65">
                  <Icon className="h-4 w-4 text-lake" aria-hidden />
                  {label}
                </p>
                <p className="metric-value mt-2 text-2xl">{value}</p>
                <p className="mt-1 text-xs leading-5 text-ink/65">{note}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
