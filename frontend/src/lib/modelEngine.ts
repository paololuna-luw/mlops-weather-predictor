import { FEATURE_NAMES, type FeatureImpact, type ModelWeights, type PredictionRequest } from "@/types/mlops";

/**
 * Same contract as `ml_pipeline/inference_math.py`.
 *
 *   scaled_i = (x_i - mean_i) / scale_i
 *   z = Σ (coefficient_i * scaled_i) + intercept
 *   P(rain) = 1 / (1 + e^(-z))
 */
export function stableSigmoid(logit: number): number {
  if (logit >= 0) {
    return 1 / (1 + Math.exp(-logit));
  }
  const expLogit = Math.exp(logit);
  return expLogit / (1 + expLogit);
}

export function isModelWeights(value: unknown): value is ModelWeights {
  if (!value || typeof value !== "object") {
    return false;
  }
  const weights = value as Partial<ModelWeights>;
  return (
    Array.isArray(weights.scaler_mean) &&
    weights.scaler_mean.length === FEATURE_NAMES.length &&
    Array.isArray(weights.scaler_scale) &&
    weights.scaler_scale.length === FEATURE_NAMES.length &&
    Array.isArray(weights.coefficients) &&
    weights.coefficients.length === FEATURE_NAMES.length &&
    typeof weights.intercept === "number" &&
    weights.scaler_mean.every((item) => typeof item === "number") &&
    weights.scaler_scale.every((item) => typeof item === "number") &&
    weights.coefficients.every((item) => typeof item === "number")
  );
}

export function featureVector(request: PredictionRequest): number[] {
  return FEATURE_NAMES.map((name) => request[name]);
}

export function predictFromWeights(request: PredictionRequest, weights: ModelWeights): {
  probability: number;
  willRain: boolean;
  logit: number;
  threshold: number;
  impacts: FeatureImpact[];
} {
  if (!isModelWeights(weights)) {
    throw new Error("Active model_weights do not match the 7-feature logistic contract.");
  }

  const raw = featureVector(request);
  const impacts: FeatureImpact[] = FEATURE_NAMES.map((feature, index) => {
    const scale = weights.scaler_scale[index] === 0 ? 1 : weights.scaler_scale[index];
    const scaledValue = (raw[index] - weights.scaler_mean[index]) / scale;
    const coefficient = weights.coefficients[index];
    return {
      feature,
      raw_value: raw[index],
      scaled_value: scaledValue,
      coefficient,
      impact: coefficient * scaledValue,
    };
  });

  const logit = impacts.reduce((sum, item) => sum + item.impact, 0) + weights.intercept;
  const probability = stableSigmoid(logit);
  const threshold = typeof weights.threshold === "number" ? weights.threshold : 0.5;

  return {
    probability,
    willRain: probability >= threshold,
    logit,
    threshold,
    impacts,
  };
}
