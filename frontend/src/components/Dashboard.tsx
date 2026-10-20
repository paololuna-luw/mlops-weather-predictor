"use client";

import { Activity, Database, Loader2, Radar, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

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
    <main className="relative mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="kicker">Puno · Lake Titicaca basin · supervised learning</p>
          <h1 className="mt-2 max-w-4xl text-3xl font-semibold tracking-tight md:text-4xl">
            Altiplano RainCast AI — Supervised MLOps Platform
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-reed-200/75 md:text-base">
            Binary classification of tomorrow&apos;s rain from seven daily Open-Meteo features.
            Production inference reads the active Supabase model on every request.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 self-start rounded-full border border-reed-400/60 bg-reed-400/10 px-4 py-2 text-sm font-medium text-reed-200 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
          Refresh Live MLOps State
        </button>
      </header>

      <section className="ops-card mt-6 flex flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-5">
        <div className="flex items-center gap-3">
          <span className={healthy ? "pulse-dot" : "h-2.5 w-2.5 rounded-full bg-amber-300"} aria-hidden />
          <p className="font-medium">
            Production Status: {healthy ? "Zero-Downtime Active" : "Awaiting Live State"}
          </p>
        </div>
        <dl className="grid gap-3 text-sm text-reed-200/80 sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-[0.12em] text-reed-200/50">Active version</dt>
            <dd className="metric-value mt-1">{active?.version ?? "Not published"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.12em] text-reed-200/50">Trained</dt>
            <dd className="mt-1">{formatTimestamp(active?.created_at)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.12em] text-reed-200/50">State read</dt>
            <dd className="mt-1">{formatTimestamp(status?.generated_at)}</dd>
          </div>
        </dl>
      </section>

      {error ? (
        <p className="mt-4 rounded-2xl border border-rose-300/30 bg-rose-950/40 px-4 py-3 text-sm" role="alert">
          {error}
        </p>
      ) : null}
      {status?.warnings?.length ? (
        <ul className="mt-4 space-y-2">
          {status.warnings.map((warning) => (
            <li key={warning} className="rounded-2xl border border-amber-200/20 bg-amber-950/20 px-4 py-3 text-sm text-amber-50">
              {warning}
            </li>
          ))}
        </ul>
      ) : null}

      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Platform views">
        {VIEWS.map((item) => {
          const selected = view === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={selected}
              onClick={() => setView(item.id)}
              className={`rounded-full px-4 py-2 text-sm ${
                selected ? "bg-reed-400 text-lake-950" : "border border-white/10 text-reed-200/80 hover:border-white/30"
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
        </div>
        <div hidden={view !== "inference"}>
          <InferenceLab forecast={status?.latest_forecast ?? null} />
        </div>
        <div hidden={view !== "registry"}>
          <RegistryPanel active={active} history={status?.model_history ?? []} />
        </div>
        <div hidden={view !== "features"}>
          <FeatureStoreTable rows={status?.recent_features ?? []} />
        </div>
      </div>

      <footer className="mt-8 flex flex-col gap-3 border-t border-white/10 py-6 text-sm text-reed-200/60 md:flex-row md:items-center md:justify-between">
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
