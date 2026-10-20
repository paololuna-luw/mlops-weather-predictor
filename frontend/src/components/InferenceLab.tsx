"use client";

import { FlaskConical, Loader2, Play } from "lucide-react";
import { useEffect, useState } from "react";

import { formatNumber, formatPercent } from "@/lib/format";
import {
  DRY_WINTER_PRESET,
  FEATURE_FIELDS,
  STORM_PRESET,
  type DailyForecast,
  type PredictionRequest,
  type PredictionResponse,
} from "@/types/mlops";

function requestFromForecast(forecast: DailyForecast | null): PredictionRequest | null {
  if (!forecast) {
    return null;
  }
  const next = { ...DRY_WINTER_PRESET };
  let complete = true;
  for (const field of FEATURE_FIELDS) {
    const value = forecast.input_features[field.key];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      complete = false;
      break;
    }
    next[field.key] = value;
  }
  return complete ? next : null;
}

export function InferenceLab({ forecast }: { forecast: DailyForecast | null }) {
  const [values, setValues] = useState<PredictionRequest>(DRY_WINTER_PRESET);
  const [seeded, setSeeded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PredictionResponse | null>(null);

  useEffect(() => {
    if (seeded) {
      return;
    }
    const seededRequest = requestFromForecast(forecast);
    if (seededRequest) {
      setValues(seededRequest);
      setSeeded(true);
    }
  }, [forecast, seeded]);

  function update(key: keyof PredictionRequest, raw: string) {
    const numeric = Number(raw);
    setValues((current) => ({
      ...current,
      [key]: Number.isFinite(numeric) ? numeric : current[key],
    }));
  }

  async function runInference(nextValues: PredictionRequest) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextValues),
      });
      const body = (await response.json()) as PredictionResponse & { error?: string };
      if (!response.ok) {
        throw new Error(body.error || "The inference request failed.");
      }
      setResult(body);
    } catch (reason) {
      setResult(null);
      setError(reason instanceof Error ? reason.message : "The inference request failed.");
    } finally {
      setLoading(false);
    }
  }

  function applyPreset(preset: PredictionRequest) {
    setValues(preset);
    setSeeded(true);
    void runInference(preset);
  }

  const maxImpact = Math.max(...(result?.impacts.map((item) => Math.abs(item.impact)) ?? [1]), 0.0001);

  return (
    <section className="ops-card p-6 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">Interactive simulator</p>
          <h2 className="mt-2 text-2xl font-semibold">Real-time inference</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-reed-200/75">
            Adjust today&apos;s seven Open-Meteo features. The serverless route reads the active
            model from Supabase, standardizes the vector, and applies the logistic function
            σ(z) = 1 / (1 + e^(−z)).
          </p>
        </div>
        <FlaskConical className="h-8 w-8 text-reed-400" aria-hidden />
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => applyPreset(DRY_WINTER_PRESET)}
          className="rounded-full border border-white/15 px-4 py-2 text-sm hover:border-reed-400"
        >
          Typical Dry Winter Day
        </button>
        <button
          type="button"
          onClick={() => applyPreset(STORM_PRESET)}
          className="rounded-full border border-white/15 px-4 py-2 text-sm hover:border-sky-300"
        >
          Heavy Storm Front
        </button>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {FEATURE_FIELDS.map((field) => (
          <label key={field.key} className="block rounded-2xl border border-white/10 bg-black/20 p-4">
            <span className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium">{field.label}</span>
              <span className="metric-value text-xs text-reed-200/70">{field.unit}</span>
            </span>
            <input
              className="mt-4 w-full"
              type="range"
              min={field.min}
              max={field.max}
              step={field.step}
              value={Math.min(field.max, Math.max(field.min, values[field.key]))}
              onChange={(event) => update(field.key, event.target.value)}
              aria-label={field.label}
            />
            <input
              className="metric-value mt-3 w-full rounded-xl border border-white/10 bg-lake-950 px-3 py-2 text-sm"
              type="number"
              step={field.step}
              value={values[field.key]}
              onChange={(event) => update(field.key, event.target.value)}
              aria-label={`${field.label} value`}
            />
          </label>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => void runInference(values)}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full bg-reed-400 px-5 py-2.5 text-sm font-semibold text-lake-950 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
          Run Live Inference
        </button>
        <p className="text-sm text-reed-200/70">POST /api/predict · active registry row, no process reload</p>
      </div>

      {error ? (
        <p className="mt-5 rounded-2xl border border-rose-300/30 bg-rose-950/30 px-4 py-3 text-sm text-rose-100" role="alert">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="mt-6 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
            <p className="kicker">{result.will_rain ? "Class Yes" : "Class No"}</p>
            <p className="mt-3 text-3xl font-semibold">
              {result.will_rain ? "RAIN EXPECTED TOMORROW" : "CLEAR / DRY CONDITIONS EXPECTED"}
            </p>
            <p className="metric-value mt-4 text-4xl text-glacial-200">{formatPercent(result.rain_probability)}</p>
            <dl className="mt-5 space-y-2 text-sm text-reed-200/80">
              <div className="flex justify-between gap-4">
                <dt>Model version</dt>
                <dd className="metric-value">{result.model_version}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Algorithm</dt>
                <dd>{result.algorithm}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Threshold</dt>
                <dd className="metric-value">{result.threshold.toFixed(2)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Logit z</dt>
                <dd className="metric-value">{result.logit.toFixed(4)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Math time</dt>
                <dd className="metric-value">{result.inference_ms.toFixed(3)} ms</dd>
              </div>
            </dl>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
            <p className="kicker">Individual impact</p>
            <h3 className="mt-2 text-lg font-semibold">wᵢ · xᵢ on the standardized feature</h3>
            <ul className="mt-4 space-y-3">
              {result.impacts.map((impact) => {
                const width = Math.max(4, (Math.abs(impact.impact) / maxImpact) * 100);
                const positive = impact.impact >= 0;
                const field = FEATURE_FIELDS.find((item) => item.key === impact.feature);
                return (
                  <li key={impact.feature}>
                    <div className="mb-1 flex justify-between gap-3 text-sm">
                      <span>{field?.label ?? impact.feature}</span>
                      <span className="metric-value text-reed-200/80">
                        {positive ? "+" : ""}
                        {impact.impact.toFixed(3)}
                      </span>
                    </div>
                    <div className="bar-track">
                      <div
                        className="bar-fill"
                        style={{
                          width: `${width}%`,
                          background: positive
                            ? "linear-gradient(90deg, #6cb6ff, #8fd8cb)"
                            : "linear-gradient(90deg, #e2b56a, #c9843a)",
                        }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-reed-200/55">
                      raw {formatNumber(impact.raw_value, 2)} · scaled {impact.scaled_value.toFixed(3)} · weight{" "}
                      {impact.coefficient.toFixed(3)}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : null}
    </section>
  );
}
