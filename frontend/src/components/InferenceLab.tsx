"use client";

import { FlaskConical, Loader2, Play } from "lucide-react";
import { useEffect, useState } from "react";

import { DetailsToggle } from "@/components/DetailsToggle";
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
          <h2 className="mt-2 text-2xl">Try another kind of day</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/75">
            Move the weather sliders, or pick a dry day or a storm, and see if tomorrow would be rainy.
          </p>
        </div>
        <FlaskConical className="h-8 w-8 text-lake" aria-hidden />
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => applyPreset(DRY_WINTER_PRESET)}
          className="soft-button rounded-full px-4 py-2 text-sm"
        >
          Typical Dry Winter Day
        </button>
        <button
          type="button"
          onClick={() => applyPreset(STORM_PRESET)}
          className="soft-button rounded-full px-4 py-2 text-sm"
        >
          Heavy Storm Front
        </button>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {FEATURE_FIELDS.map((field) => (
          <label key={field.key} className="block rounded-2xl border border-ink/10 bg-white/40 p-4">
            <span className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium">{field.label}</span>
              <span className="metric-value text-xs text-ink/70">{field.unit}</span>
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
              className="metric-value mt-3 w-full rounded-xl border border-ink/10 bg-mist px-3 py-2 text-sm"
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
          className="inline-flex items-center gap-2 rounded-full bg-lake px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
          Run Live Inference
        </button>
        <DetailsToggle label="How this prediction is calculated">
          <p className="max-w-3xl text-sm leading-6 text-ink/75">
            Adjust today&apos;s seven Open-Meteo features. The serverless route reads the active
            model from Supabase, standardizes the vector, and applies the logistic function
            σ(z) = 1 / (1 + e^(−z)). POST /api/predict uses the active registry row, with no process reload.
          </p>
        </DetailsToggle>
      </div>

      {error ? (
        <p className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900" role="alert">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="mt-6 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-2xl border border-ink/10 bg-white/40 p-5">
            <p className="kicker">Answer</p>
            <p className="mt-3 text-3xl">
              {result.will_rain ? "RAIN EXPECTED TOMORROW" : "CLEAR / DRY CONDITIONS EXPECTED"}
            </p>
            <p className="metric-value mt-4 text-4xl text-deep">{formatPercent(result.rain_probability)}</p>
            <div className="relative mt-3 h-2.5 rounded-full bg-ink/10" aria-hidden>
              <div className="h-full rounded-full bg-lake" style={{ width: `${Math.min(Math.max(result.rain_probability, 0), 1) * 100}%` }} />
              <span className="absolute -top-1 w-0.5 -translate-x-1/2 bg-ink/50" style={{ left: `${result.threshold * 100}%`, height: "1.15rem" }} />
            </div>
            <p className="mt-4 text-sm text-ink/70">Model {result.model_version}</p>
            <DetailsToggle label="Technical readout">
              <dl className="space-y-2 text-sm text-ink/80">
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
            </DetailsToggle>
          </div>
          <div className="rounded-2xl border border-ink/10 bg-white/40 p-5">
            <p className="kicker">Why this answer</p>
            <h3 className="mt-2 text-lg">Which parts of today mattered</h3>
            <ul className="mt-4 space-y-2 text-sm">
              {result.impacts.map((impact) => {
                const field = FEATURE_FIELDS.find((item) => item.key === impact.feature);
                const positive = impact.impact >= 0;
                return (
                  <li key={impact.feature} className="flex justify-between gap-4 border-b border-ink/5 pb-2">
                    <span>{field?.label ?? impact.feature}</span>
                    <span className={positive ? "text-lake" : "text-totora"}>
                      {positive ? "toward rain" : "toward dry"}
                    </span>
                  </li>
                );
              })}
            </ul>
            <DetailsToggle label="Feature impacts, wᵢ · xᵢ">
              <ul className="space-y-3">
                {result.impacts.map((impact) => {
                  const width = Math.max(4, (Math.abs(impact.impact) / maxImpact) * 100);
                  const positive = impact.impact >= 0;
                  const field = FEATURE_FIELDS.find((item) => item.key === impact.feature);
                  return (
                    <li key={impact.feature}>
                      <div className="mb-1 flex justify-between gap-3 text-sm">
                        <span>{field?.label ?? impact.feature}</span>
                        <span className="metric-value text-ink/80">
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
                              ? "linear-gradient(90deg, #7fb4ff, #4c7fe6)"
                              : "linear-gradient(90deg, #c9b8ea, #7b5fc0)",
                          }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-ink/55">
                        raw {formatNumber(impact.raw_value, 2)} · scaled {impact.scaled_value.toFixed(3)} · weight{" "}
                        {impact.coefficient.toFixed(3)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </DetailsToggle>
          </div>
        </div>
      ) : null}
    </section>
  );
}
