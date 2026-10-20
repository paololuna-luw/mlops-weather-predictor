import { NextResponse } from "next/server";

import { loadActiveModel, normalizeFeature, normalizeForecast, normalizeModel } from "@/lib/registry";
import { getServerSupabase, hasServerSupabaseConfig } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const LOCATION = {
  city: "Puno",
  country: "Peru",
  latitude: -15.8402,
  longitude: -70.0219,
  timezone: "America/Lima",
};

export async function GET() {
  if (!hasServerSupabaseConfig()) {
    return NextResponse.json(
      {
        error: "Supabase environment variables are not configured on the server.",
        production_status: "Configuration required",
        location: LOCATION,
        active_model: null,
        latest_forecast: null,
        model_history: [],
        recent_features: [],
        generated_at: new Date().toISOString(),
        warnings: ["Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before requesting live state."],
      },
      { status: 503 },
    );
  }

  const warnings: string[] = [];
  try {
    const supabase = getServerSupabase();
    const { model, warning } = await loadActiveModel();
    if (warning) {
      warnings.push(warning);
    }

    const [historyResult, forecastResult, featureResult] = await Promise.all([
      supabase.from("model_registry").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("daily_forecasts").select("*").order("created_at", { ascending: false }).limit(1),
      supabase.from("weather_features").select("*").order("date", { ascending: false }).limit(10),
    ]);

    if (historyResult.error) {
      throw new Error(historyResult.error.message);
    }
    if (forecastResult.error) {
      throw new Error(forecastResult.error.message);
    }
    if (featureResult.error) {
      throw new Error(featureResult.error.message);
    }

    const modelHistory = (historyResult.data ?? [])
      .map((row) => normalizeModel(row as Record<string, unknown>))
      .filter((row): row is NonNullable<typeof row> => row !== null);
    const latestForecast = normalizeForecast(
      ((forecastResult.data ?? [])[0] as Record<string, unknown> | undefined) ?? null,
    );
    const recentFeatures = (featureResult.data ?? []).map((row) =>
      normalizeFeature(row as Record<string, unknown>),
    );

    if (!model) {
      warnings.push("Publish the first model to activate live inference.");
    }
    if (!latestForecast) {
      warnings.push("No automated forecast has been stored in daily_forecasts yet.");
    }
    if (recentFeatures.length === 0) {
      warnings.push("The feature store is empty. Run the Open-Meteo ingestion step.");
    }

    return NextResponse.json({
      production_status: "Zero-Downtime Active",
      location: LOCATION,
      active_model: model,
      latest_forecast: latestForecast,
      model_history: modelHistory,
      recent_features: recentFeatures,
      generated_at: new Date().toISOString(),
      warnings,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to read MLOps state.";
    return NextResponse.json(
      {
        error: message,
        production_status: "Degraded",
        location: LOCATION,
        active_model: null,
        latest_forecast: null,
        model_history: [],
        recent_features: [],
        generated_at: new Date().toISOString(),
        warnings: [message],
      },
      { status: 500 },
    );
  }
}
