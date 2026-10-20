import { NextResponse } from "next/server";

import { predictFromWeights } from "@/lib/modelEngine";
import { loadActiveModel } from "@/lib/registry";
import { hasServerSupabaseConfig } from "@/lib/supabase";
import { FEATURE_NAMES, type PredictionRequest } from "@/types/mlops";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function readRequest(body: unknown): PredictionRequest | null {
  if (!body || typeof body !== "object") {
    return null;
  }
  const record = body as Record<string, unknown>;
  const parsed = {} as PredictionRequest;
  for (const name of FEATURE_NAMES) {
    const value = record[name];
    const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
    if (!Number.isFinite(numeric)) {
      return null;
    }
    parsed[name] = numeric;
  }
  return parsed;
}

export async function POST(request: Request) {
  if (!hasServerSupabaseConfig()) {
    return NextResponse.json(
      { error: "Supabase environment variables are not configured on the server." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const features = readRequest(body);
  if (!features) {
    return NextResponse.json(
      {
        error: "Provide all seven finite weather features.",
        required: FEATURE_NAMES,
      },
      { status: 400 },
    );
  }

  try {
    const { model, warning } = await loadActiveModel();
    if (!model || !model.model_weights) {
      return NextResponse.json(
        {
          error: "No active model with model_weights is available. Publish one with the MLOps training workflow.",
          warning,
        },
        { status: 404 },
      );
    }

    const started = performance.now();
    const prediction = predictFromWeights(features, model.model_weights);
    const inferenceMs = performance.now() - started;

    return NextResponse.json({
      will_rain: prediction.willRain,
      rain_probability: prediction.probability,
      label: prediction.willRain ? "Yes" : "No",
      model_version: model.version,
      algorithm: model.algorithm,
      threshold: prediction.threshold,
      inference_ms: Number(inferenceMs.toFixed(3)),
      logit: prediction.logit,
      impacts: prediction.impacts,
      input_features: features,
      storage_path: model.storage_path,
      warning,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Inference failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
