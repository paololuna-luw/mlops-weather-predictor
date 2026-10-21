"use client";

import { Activity, Database, Loader2, Radar, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { AltiplanoReading } from "@/components/AltiplanoReading";
import { RainHeatmap } from "@/components/RainHeatmap";
import { FeatureStoreTable } from "@/components/FeatureStoreTable";
import { ForecastHero } from "@/components/ForecastHero";
import { InferenceLab } from "@/components/InferenceLab";
import { RegistryPanel } from "@/components/RegistryPanel";
import { formatTimestamp } from "@/lib/format";
import type { StatusResponse } from "@/types/mlops";

type ViewId = "forecast" | "inference" | "registry" | "features";

const VIEWS: { id: ViewId; label: string }[] = [
  { id: "forecast", label: "Tomorrow Forecast" },
  { id: "inference", label: "Live Inference" },
  { id: "registry", label: "Model Registry" },
  { id: "features", label: "Feature Store" },
];

export function Dashboard() {
  const [view, setView] = useState<ViewId>("forecast");
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/status", { cache: "no-store" });
      const body = (await response.json()) as StatusResponse & { error?: string };
      if (!response.ok) {
        throw new Error(body.error || "Unable to read the live MLOps state.");
      }
      setStatus(body);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to read the live MLOps state.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const active = status?.active_model ?? null;
  const healthy = Boolean(status) && !error;

  return (
    <main className="relative z-10 mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-12">
      <header className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="kicker">Puno · Lake Titicaca basin</p>
          <h1 className="mt-3 max-w-3xl text-3xl leading-tight tracking-tight md:text-5xl">
            Altiplano RainCast AI — Supervised MLOps Platform
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-ink/70">
            Will it rain tomorrow in Puno? A live model that learns from fresh weather data every few hours.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="soft-button inline-flex items-center justify-center gap-2 self-start rounded-full px-4 py-2 text-sm font-medium text-lake disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
          Refresh Live MLOps State
        </button>
      </header>

      <section className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-2xl border border-ink/10 bg-mist/70 px-5 py-3.5 text-sm">
        <p className="flex items-center gap-2.5 font-medium">
          <span className={healthy ? "pulse-dot" : "h-2.5 w-2.5 rounded-full bg-totora"} aria-hidden />
          Production Status: {healthy ? "Zero-Downtime Active" : "Awaiting Live State"}
        </p>
        <p className="text-ink/65">
          Version <span className="metric-value text-ink">{active?.version ?? "Not published"}</span>
        </p>
        <p className="text-ink/65">Trained {formatTimestamp(active?.created_at)}</p>
      </section>

      {error ? (
        <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 text-rose-900 px-4 py-3 text-sm" role="alert">
          {error}
        </p>
      ) : null}
      {status?.warnings?.length ? (
        <ul className="mt-4 space-y-2">
          {status.warnings.map((warning) => (
            <li key={warning} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {warning}
            </li>
          ))}
        </ul>
      ) : null}

      <nav className="mt-8 inline-flex flex-wrap gap-1 rounded-full bg-white/40 p-1" aria-label="Platform views">
        {VIEWS.map((item) => {
          const selected = view === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={selected}
              onClick={() => setView(item.id)}
              className={`rounded-full px-4 py-2 text-sm ${
                selected ? "bg-lake text-white shadow-sm" : "text-ink/70 hover:bg-white/60"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="mt-6">
        <div hidden={view !== "forecast"}>
          <ForecastHero forecast={status?.latest_forecast ?? null} />
          <AltiplanoReading forecast={status?.latest_forecast ?? null} active={active} />
        </div>
        <div hidden={view !== "inference"}>
          <InferenceLab forecast={status?.latest_forecast ?? null} />
        </div>
        <div hidden={view !== "registry"}>
          <RegistryPanel active={active} history={status?.model_history ?? []} />
        </div>
        <div hidden={view !== "features"}>
          <RainHeatmap />
          <div className="mt-6" />
          <FeatureStoreTable rows={status?.recent_features ?? []} />
        </div>
      </div>

      <footer className="mt-8 flex flex-col gap-3 border-t border-ink/10 py-6 text-sm text-ink/60 md:flex-row md:items-center md:justify-between">
        <p className="inline-flex items-center gap-2">
          <Radar className="h-4 w-4" aria-hidden />
          Open-Meteo · Supabase PostgreSQL · Supabase Storage · scikit-learn · GitHub Actions · Vercel
        </p>
        <p className="inline-flex items-center gap-4">
          <span className="inline-flex items-center gap-1">
            <Activity className="h-4 w-4" aria-hidden />
            Stateless hot-swap
          </span>
          <span className="inline-flex items-center gap-1">
            <Database className="h-4 w-4" aria-hidden />
            Bucket models
          </span>
        </p>
      </footer>
    </main>
  );
}
