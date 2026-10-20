"""Decoupled inference for StandardScaler + binary LogisticRegression.

This module is the mathematical contract shared with
`frontend/src/lib/modelEngine.ts`. A model is published only when these
probabilities match `Pipeline.predict_proba` within 1e-6 absolute tolerance.

    z = w · ((x - mean) / scale) + b
    P(rain) = 1 / (1 + exp(-z))
"""

from __future__ import annotations

from typing import Any

import numpy as np

from ml_pipeline.config import DECISION_THRESHOLD, FEATURE_COLUMNS


def stable_sigmoid(logits: np.ndarray) -> np.ndarray:
    """Sigmoid that stays finite for large positive and negative logits."""
    logits = np.asarray(logits, dtype=float)
    output = np.empty_like(logits, dtype=float)
    positive = logits >= 0
    output[positive] = 1.0 / (1.0 + np.exp(-logits[positive]))
    negative_exp = np.exp(logits[~positive])
    output[~positive] = negative_exp / (1.0 + negative_exp)
    return output


def extract_model_weights(
    estimator: Any,
    feature_names: list[str] | None = None,
    threshold: float = DECISION_THRESHOLD,
) -> dict[str, Any]:
    """Read the fitted scaler and logistic coefficients into JSON-safe lists."""
    names = list(feature_names or FEATURE_COLUMNS)
    scaler = estimator.named_steps["scaler"]
    classifier = estimator.named_steps["classifier"]
    coefficients = np.asarray(classifier.coef_, dtype=float).ravel()
    intercept = float(np.asarray(classifier.intercept_, dtype=float).ravel()[0])
    mean = np.asarray(scaler.mean_, dtype=float).ravel()
    scale = np.asarray(scaler.scale_, dtype=float).ravel()
    if not (len(names) == coefficients.size == mean.size == scale.size):
        raise ValueError(
            "Feature names, coefficients, scaler mean and scaler scale must share one length."
        )
    return {
        "feature_names": names,
        "scaler_mean": [float(value) for value in mean],
        "scaler_scale": [float(value) for value in scale],
        "coefficients": [float(value) for value in coefficients],
        "intercept": intercept,
        "threshold": float(threshold),
    }


def _weight_vectors(model_weights: dict[str, Any]) -> tuple[np.ndarray, np.ndarray, np.ndarray, float]:
    mean = np.asarray(model_weights["scaler_mean"], dtype=float).ravel()
    scale = np.asarray(model_weights["scaler_scale"], dtype=float).ravel()
    coefficients = np.asarray(model_weights["coefficients"], dtype=float).ravel()
    intercept = float(model_weights["intercept"])
    if not (mean.size == scale.size == coefficients.size):
        raise ValueError("model_weights arrays must have the same length.")
    safe_scale = np.where(scale == 0.0, 1.0, scale)
    return mean, safe_scale, coefficients, intercept


def scale_features(features: np.ndarray, model_weights: dict[str, Any]) -> np.ndarray:
    matrix = np.asarray(features, dtype=float)
    if matrix.ndim == 1:
        matrix = matrix.reshape(1, -1)
    mean, scale, _, _ = _weight_vectors(model_weights)
    if matrix.shape[1] != mean.size:
        raise ValueError(
            f"Expected {mean.size} features, received {matrix.shape[1]}."
        )
    return (matrix - mean) / scale


def predict_positive_proba(features: np.ndarray, model_weights: dict[str, Any]) -> np.ndarray:
    """Return P(target = 1) for one sample or for a batch."""
    _, _, coefficients, intercept = _weight_vectors(model_weights)
    scaled = scale_features(features, model_weights)
    logits = scaled @ coefficients + intercept
    return stable_sigmoid(logits)


def feature_impacts(features: np.ndarray, model_weights: dict[str, Any]) -> list[dict[str, float | str]]:
    """Per-feature contribution w_i * x_i_scaled to the logit."""
    sample = np.asarray(features, dtype=float).reshape(-1)
    scaled = scale_features(sample, model_weights).reshape(-1)
    _, _, coefficients, _ = _weight_vectors(model_weights)
    names = [str(name) for name in model_weights.get("feature_names", FEATURE_COLUMNS)]
    if len(names) != sample.size:
        names = [f"feature_{index}" for index in range(sample.size)]
    impacts: list[dict[str, float | str]] = []
    for index, name in enumerate(names):
        impacts.append(
            {
                "feature": name,
                "raw_value": float(sample[index]),
                "scaled_value": float(scaled[index]),
                "coefficient": float(coefficients[index]),
                "impact": float(coefficients[index] * scaled[index]),
            }
        )
    return impacts
