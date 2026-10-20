import type {
  DailyForecast,
  FeatureName,
  ModelRegistryRecord,
  ModelWeights,
  WeatherFeature,
} from "@/types/mlops";
import { FEATURE_NAMES } from "@/types/mlops";
import { getServerSupabase } from "@/lib/supabase";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  if (typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asMatrix(value: unknown): number[][] | null {
  const source = typeof value === "string" ? asRecord(value) : value;
  if (!Array.isArray(source) || source.length !== 2) {
    return null;
  }
  const matrix = source.map((row) => {
    if (!Array.isArray(row) || row.length !== 2) {
      return null;
    }
    return row.map((cell) => asNumber(cell));
  });
  if (matrix.some((row) => row === null || row.some((cell) => cell === null))) {
    return null;
  }
  return matrix as number[][];
}

function asNumberArray(value: unknown, length: number): number[] | null {
  const source = typeof value === "string" ? asRecord(value) : value;
  if (!Array.isArray(source) || source.length !== length) {
    return null;
  }
  const numbers = source.map((item) => asNumber(item));
  if (numbers.some((item) => item === null)) {
    return null;
  }
  return numbers as number[];
}

function asWeights(value: unknown): ModelWeights | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }
  const scalerMean = asNumberArray(record.scaler_mean, FEATURE_NAMES.length);
  const scalerScale = asNumberArray(record.scaler_scale, FEATURE_NAMES.length);
  const coefficients = asNumberArray(record.coefficients, FEATURE_NAMES.length);
  const intercept = asNumber(record.intercept);
  if (!scalerMean || !scalerScale || !coefficients || intercept === null) {
    return null;
  }
  const names = Array.isArray(record.feature_names)
    ? record.feature_names.map(String)
    : [...FEATURE_NAMES];
  return {
    feature_names: names.length === FEATURE_NAMES.length ? names : [...FEATURE_NAMES],
    scaler_mean: scalerMean,
    scaler_scale: scalerScale,
    coefficients,
    intercept,
    threshold: asNumber(record.threshold) ?? 0.5,
  };
}

export function normalizeModel(row: Record<string, unknown> | null): ModelRegistryRecord | null {
  if (!row) {
    return null;
  }
  return {
    id: asNumber(row.id) ?? 0,
    version: String(row.version ?? "unknown"),
    created_at: String(row.created_at ?? ""),
    algorithm: String(row.algorithm ?? "LogisticRegression (GridSearchCV)"),
    best_hyperparameters: asRecord(row.best_hyperparameters) ?? {},
    accuracy: asNumber(row.accuracy),
    f1_score: asNumber(row.f1_score),
    roc_auc: asNumber(row.roc_auc),
    confusion_matrix: asMatrix(row.confusion_matrix),
    dataset_rows: asNumber(row.dataset_rows),
    model_weights: asWeights(row.model_weights),
    storage_path: row.storage_path ? String(row.storage_path) : null,
    is_active: Boolean(row.is_active),
  };
}

export function normalizeForecast(row: Record<string, unknown> | null): DailyForecast | null {
  if (!row) {
    return null;
  }
  const rawFeatures = asRecord(row.input_features) ?? {};
  const input: Partial<Record<FeatureName, number>> = {};
  for (const name of FEATURE_NAMES) {
    const value = asNumber(rawFeatures[name]);
    if (value !== null) {
      input[name] = value;
    }
  }
  const probability = asNumber(row.rain_probability) ?? 0;
  return {
    id: asNumber(row.id) ?? 0,
    forecast_for_date: String(row.forecast_for_date ?? ""),
    created_at: String(row.created_at ?? ""),
    model_version: String(row.model_version ?? ""),
    will_rain: Boolean(row.will_rain),
    rain_probability: probability,
    input_features: input,
  };
}

export function normalizeFeature(row: Record<string, unknown>): WeatherFeature {
  return {
    date: String(row.date ?? ""),
    temperature_2m_max: asNumber(row.temperature_2m_max),
    temperature_2m_min: asNumber(row.temperature_2m_min),
    apparent_temperature_max: asNumber(row.apparent_temperature_max),
    wind_speed_10m_max: asNumber(row.wind_speed_10m_max),
    shortwave_radiation_sum: asNumber(row.shortwave_radiation_sum),
    et0_fao_evapotranspiration: asNumber(row.et0_fao_evapotranspiration),
    precipitation_sum: asNumber(row.precipitation_sum),
    target_rain_tomorrow:
      row.target_rain_tomorrow === null || row.target_rain_tomorrow === undefined
        ? null
        : asNumber(row.target_rain_tomorrow),
  };
}

export async function loadActiveModel(): Promise<{ model: ModelRegistryRecord | null; warning: string | null }> {
  const supabase = getServerSupabase();
  const active = await supabase
    .from("model_registry")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1);
  if (active.error) {
    throw new Error(active.error.message);
  }
  const activeRow = (active.data ?? [])[0] as Record<string, unknown> | undefined;
  if (activeRow) {
    return { model: normalizeModel(activeRow), warning: null };
  }

  const latest = await supabase
    .from("model_registry")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1);
  if (latest.error) {
    throw new Error(latest.error.message);
  }
  const latestRow = (latest.data ?? [])[0] as Record<string, unknown> | undefined;
  if (!latestRow) {
    return { model: null, warning: "No model has been published to model_registry yet." };
  }
  return {
    model: normalizeModel(latestRow),
    warning: "No row is marked active. Showing the most recently created registry entry.",
  };
}
