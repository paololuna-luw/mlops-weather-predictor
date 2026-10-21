"use client";

import { Activity, Database, Loader2, Radar, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { AltiplanoReading } from "@/components/AltiplanoReading";
import { DetailsToggle } from "@/components/DetailsToggle";
import { RainHeatmap } from "@/components/RainHeatmap";
import { FeatureStoreTable } from "@/components/FeatureStoreTable";
import { ForecastHero } from "@/components/ForecastHero";
import { InferenceLab } from "@/components/InferenceLab";
import { RegistryPanel } from "@/components/RegistryPanel";
import { TodayMosaic } from "@/components/TodayMosaic";
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
  const [statusOpen, setStatusOpen] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!statusOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setStatusOpen(false);
    }
    function onPointer(event: MouseEvent) {
      if (!statusRef.current?.contains(event.target as Node)) setStatusOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [statusOpen]);

  const active = status?.active_model ?? null;
  const healthy = Boolean(status) && !error;

  return (
    <main className="relative z-10 mx-auto max-w-6xl px-4 py-4 md:px-6 md:py-5">
      <header>
        <div className="flex items-center justify-between gap-3">
          <p className="kicker">Puno · Lake Titicaca basin</p>
          <div className="relative z-30 shrink-0" ref={statusRef}>
            <button
              type="button"
              aria-expanded={statusOpen}
              aria-controls="live-status-card"
              onClick={() => setStatusOpen((open) => !open)}
              className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-white/75 px-3 py-1.5 text-sm font-medium shadow-sm"
            >
              <span className={healthy ? "pulse-dot" : "h-2.5 w-2.5 rounded-full bg-totora"} aria-hidden />
              {healthy ? "Live" : "Waiting"}
            </button>
            {statusOpen ? (
              <div
                id="live-status-card"
                role="region"
                aria-label="Production status"
                className="status-pop absolute right-0 z-20 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-ink/10 bg-white/95 p-4 text-sm shadow-lg backdrop-blur"
              >
                <p className="font-medium">{healthy ? "Zero-downtime active" : "Awaiting a live model"}</p>
                <p className="mt-3 text-ink/65">
                  Version{" "}
                  <span className="metric-value break-all text-ink">{active?.version ?? "Not published"}</span>
                </p>
                <p className="mt-1 text-ink/65">Trained {formatTimestamp(active?.created_at)}</p>
                <button
                  type="button"
                  onClick={() => void refresh()}
                  disabled={loading}
                  className="soft-button mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-lake disabled:opacity-60"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
                  Refresh
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <h1 className="mt-2 text-4xl leading-tight tracking-tight md:text-[2.75rem]">
          Altiplano RainCast AI — Supervised MLOps Platform
        </h1>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <p className="max-w-xl text-base leading-6 text-ink/70">
            Will it rain tomorrow in Puno? A live model that learns from fresh weather data every few hours.
          </p>
          <TodayMosaic forecast={status?.latest_forecast ?? null} />
        </div>
      </header>

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

      <nav className="mt-4 inline-flex flex-wrap gap-1 rounded-full bg-white/40 p-1" aria-label="Platform views">
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

      <div className="mt-4">
        <div hidden={view !== "forecast"}>
          <ForecastHero forecast={status?.latest_forecast ?? null} />
          <AltiplanoReading forecast={status?.latest_forecast ?? null} active={active} />
        </div>
        <div hidden={view !== "inference"}>
          <InferenceLab forecast={status?.latest_forecast ?? null} />
        </div>
        {view === "registry" ? <RegistryPanel active={active} history={status?.model_history ?? []} /> : null}
        {view === "features" ? (
          <>
            <RainHeatmap />
            <div className="mt-6" />
            <FeatureStoreTable rows={status?.recent_features ?? []} />
          </>
        ) : null}
      </div>

      <footer className="mt-8 border-t border-ink/10 py-5 text-sm text-ink/60">
        <DetailsToggle label="Tools behind this forecast">
          <p className="inline-flex items-center gap-2">
            <Radar className="h-4 w-4" aria-hidden />
            Open-Meteo · Supabase PostgreSQL · Supabase Storage · scikit-learn · GitHub Actions · Vercel
          </p>
          <p className="mt-2 inline-flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1">
              <Activity className="h-4 w-4" aria-hidden />
              Stateless hot-swap
            </span>
            <span className="inline-flex items-center gap-1">
              <Database className="h-4 w-4" aria-hidden />
              Bucket models
            </span>
          </p>
        </DetailsToggle>
      </footer>
    </main>
  );
}
