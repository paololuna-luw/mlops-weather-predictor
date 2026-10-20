export const FEATURE_NAMES = [
  "temperature_2m_max",
  "temperature_2m_min",
  "apparent_temperature_max",
  "wind_speed_10m_max",
  "shortwave_radiation_sum",
  "et0_fao_evapotranspiration",
  "precipitation_sum",
] as const;

export type FeatureName = (typeof FEATURE_NAMES)[number];

export interface FeatureField {
  key: FeatureName;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  digits: number;
}

export const FEATURE_FIELDS: FeatureField[] = [
  {
    key: "temperature_2m_max",
    label: "Maximum temperature",
    unit: "°C",
    min: -5,
    max: 28,
    step: 0.1,
    digits: 1,
  },
  {
    key: "temperature_2m_min",
    label: "Minimum temperature",
    unit: "°C",
    min: -12,
    max: 16,
    step: 0.1,
    digits: 1,
  },
  {
    key: "apparent_temperature_max",
    label: "Maximum apparent temperature",
    unit: "°C",
    min: -8,
    max: 28,
    step: 0.1,
    digits: 1,
  },
  {
    key: "wind_speed_10m_max",
    label: "Maximum wind speed",
    unit: "km/h",
    min: 0,
    max: 80,
    step: 0.1,
    digits: 1,
  },
  {
    key: "shortwave_radiation_sum",
    label: "Shortwave radiation sum",
    unit: "MJ/m²",
    min: 0,
    max: 35,
    step: 0.1,
    digits: 1,
  },
  {
    key: "et0_fao_evapotranspiration",
    label: "FAO ET0 evapotranspiration",
    unit: "mm",
    min: 0,
    max: 10,
    step: 0.1,
    digits: 2,
  },
  {
    key: "precipitation_sum",
    label: "Precipitation sum",
    unit: "mm",
    min: 0,
    max: 50,
    step: 0.1,
    digits: 2,
  },
];

export interface ModelWeights {
  feature_names: string[];
  scaler_mean: number[];
  scaler_scale: number[];
  coefficients: number[];
  intercept: number;
  threshold: number;
}

export interface WeatherFeature {
  date: string;
  temperature_2m_max: number | null;
  temperature_2m_min: number | null;
  apparent_temperature_max: number | null;
  wind_speed_10m_max: number | null;
  shortwave_radiation_sum: number | null;
  et0_fao_evapotranspiration: number | null;
  precipitation_sum: number | null;
  target_rain_tomorrow: number | null;
}

export interface ModelRegistryRecord {
  id: number;
  version: string;
  created_at: string;
  algorithm: string;
  best_hyperparameters: Record<string, unknown>;
  accuracy: number | null;
  f1_score: number | null;
  roc_auc: number | null;
  confusion_matrix: number[][] | null;
  dataset_rows: number | null;
  model_weights: ModelWeights | null;
  storage_path: string | null;
  is_active: boolean;
}

export interface DailyForecast {
  id: number;
  forecast_for_date: string;
  created_at: string;
  model_version: string;
  will_rain: boolean;
  rain_probability: number;
  input_features: Partial<Record<FeatureName, number>>;
}

export interface PredictionRequest {
  temperature_2m_max: number;
  temperature_2m_min: number;
  apparent_temperature_max: number;
  wind_speed_10m_max: number;
  shortwave_radiation_sum: number;
  et0_fao_evapotranspiration: number;
  precipitation_sum: number;
}

export interface FeatureImpact {
  feature: string;
  raw_value: number;
  scaled_value: number;
  coefficient: number;
  impact: number;
}

export interface PredictionResponse {
  will_rain: boolean;
  rain_probability: number;
  label: "Yes" | "No";
  model_version: string;
  algorithm: string;
  threshold: number;
  inference_ms: number;
  logit: number;
  impacts: FeatureImpact[];
  input_features: PredictionRequest;
  storage_path: string | null;
}

export interface StatusResponse {
  production_status: string;
  location: {
    city: string;
    country: string;
    latitude: number;
    longitude: number;
    timezone: string;
  };
  active_model: ModelRegistryRecord | null;
  latest_forecast: DailyForecast | null;
  model_history: ModelRegistryRecord[];
  recent_features: WeatherFeature[];
  generated_at: string;
  warnings: string[];
}

export const DRY_WINTER_PRESET: PredictionRequest = {
  temperature_2m_max: 14.5,
  temperature_2m_min: -1.8,
  apparent_temperature_max: 12.4,
  wind_speed_10m_max: 17,
  shortwave_radiation_sum: 23.5,
  et0_fao_evapotranspiration: 4.4,
  precipitation_sum: 0,
};

export const STORM_PRESET: PredictionRequest = {
  temperature_2m_max: 11.2,
  temperature_2m_min: 5.8,
  apparent_temperature_max: 9.1,
  wind_speed_10m_max: 36,
  shortwave_radiation_sum: 6.2,
  et0_fao_evapotranspiration: 1.3,
  precipitation_sum: 16.5,
};
