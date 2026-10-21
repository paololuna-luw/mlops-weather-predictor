import { Snowflake, Sun, Thermometer, Wind } from "lucide-react";

import { formatNumber } from "@/lib/format";
import { FEATURE_NAMES, type DailyForecast, type PredictionRequest } from "@/types/mlops";

function nightNote(min: number): string {
  if (min <= 0) return "Frost likely";
  if (min <= 4) return "Light frost possible";
  return "Mild night";
}

function windNote(kmh: number): string {
  if (kmh < 15) return "Calm";
  if (kmh < 30) return "Breezy";
  return "Strong on the lake";
}

function sunNote(mj: number): string {
  if (mj < 12) return "Mostly overcast";
  if (mj < 22) return "Partly sunny";
  return "Intense sun";
}

export function TodayMosaic({ forecast }: { forecast: DailyForecast | null }) {
  if (!forecast) return null;

  const input = forecast.input_features;
  const complete = FEATURE_NAMES.every((name) => typeof input[name] === "number" && Number.isFinite(input[name]));
  if (!complete) return null;

  const full = input as PredictionRequest;
  const cells = [
    { icon: Snowflake, label: "Night", value: `${formatNumber(full.temperature_2m_min, 1)}°`, note: nightNote(full.temperature_2m_min) },
    { icon: Thermometer, label: "Day", value: `${formatNumber(full.temperature_2m_max, 1)}°`, note: `${formatNumber(full.temperature_2m_max - full.temperature_2m_min, 0)}° above night` },
    { icon: Wind, label: "Wind", value: `${formatNumber(full.wind_speed_10m_max, 0)} km/h`, note: windNote(full.wind_speed_10m_max) },
    { icon: Sun, label: "Sun", value: `${formatNumber(full.shortwave_radiation_sum, 0)} MJ`, note: sunNote(full.shortwave_radiation_sum) },
  ];

  return (
    <section aria-label="Today in Puno" className="flex overflow-hidden rounded-2xl border border-ink/10 bg-white/60">
      <p className="flex items-center px-3 text-[11px] font-medium uppercase tracking-wide text-ink/45">Today</p>
      {cells.map(({ icon: Icon, label, value, note }, index) => (
        <article
          key={label}
          title={note}
          className="today-tile flex min-w-0 items-center gap-2 border-l border-ink/10 px-3 py-1.5"
          style={{ animationDelay: `${index * 60}ms` }}
        >
          <Icon className="h-4 w-4 shrink-0 text-lake" aria-hidden />
          <div className="min-w-0 leading-tight">
            <p className="metric-value text-base text-ink">{value}</p>
            <p className="truncate text-[11px] text-ink/55">{label}</p>
          </div>
        </article>
      ))}
    </section>
  );
}
