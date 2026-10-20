"""Offline pytest suite for features, GridSearchCV, and inference parity.

These tests use a reproducible synthetic climate. They do not call Open-Meteo
or Supabase, so GitHub Actions can run them before any secret is used.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from ml_pipeline.config import (
    FEATURE_COLUMNS,
    FEATURE_UNITS,
    LATITUDE,
    LONGITUDE,
    RAIN_THRESHOLD_MM,
    TIMEZONE,
)
from ml_pipeline.fetch_data import assemble_feature_frame
from ml_pipeline.inference_math import extract_model_weights, predict_positive_proba
from ml_pipeline.train_and_evaluate import (
    evaluate_on_holdout,
    fit_grid_search,
)


def _synthetic_training_set(rows: int = 420, seed: int = 42) -> tuple[np.ndarray, np.ndarray]:
    generator = np.random.default_rng(seed)
    temperature_max = generator.normal(15.5, 2.8, rows)
    temperature_min = temperature_max - generator.uniform(5.0, 14.0, rows)
    apparent = temperature_max - generator.normal(1.4, 0.7, rows)
    wind = generator.uniform(4.0, 42.0, rows)
    radiation = generator.uniform(4.0, 30.0, rows)
    evapotranspiration = generator.uniform(0.8, 7.5, rows)
    precipitation = generator.exponential(1.8, rows)
    logits = (
        -1.35
        + 0.42 * precipitation
        - 0.07 * radiation
        + 0.03 * wind
        + 0.04 * temperature_min
        - 0.15 * evapotranspiration
    )
    probabilities = 1.0 / (1.0 + np.exp(-logits))
    target = generator.binomial(1, np.clip(probabilities, 0.05, 0.95))
    features = np.column_stack(
        [
            temperature_max,
            temperature_min,
            apparent,
            wind,
            radiation,
            evapotranspiration,
            precipitation,
        ]
    )
    return features.astype(float), target.astype(int)


def test_feature_columns_definition() -> None:
    assert FEATURE_COLUMNS == [
        "temperature_2m_max",
        "temperature_2m_min",
        "apparent_temperature_max",
        "wind_speed_10m_max",
        "shortwave_radiation_sum",
        "et0_fao_evapotranspiration",
        "precipitation_sum",
    ]
    assert len(FEATURE_COLUMNS) == 7
    assert len(set(FEATURE_COLUMNS)) == 7
    assert set(FEATURE_UNITS) == set(FEATURE_COLUMNS)
    assert LATITUDE == -15.8402
    assert LONGITUDE == -70.0219
    assert TIMEZONE == "America/Lima"
    assert RAIN_THRESHOLD_MM == 1.0

    archive = pd.DataFrame(
        {
            "date": ["2026-10-17", "2026-10-18", "2026-10-19"],
            "temperature_2m_max": [16.0, 15.0, None],
            "temperature_2m_min": [2.0, 3.0, 4.0],
            "apparent_temperature_max": [15.0, 14.0, 13.0],
            "wind_speed_10m_max": [12.0, 18.0, 20.0],
            "shortwave_radiation_sum": [22.0, 18.0, 11.0],
            "et0_fao_evapotranspiration": [4.0, 3.2, 2.4],
            "precipitation_sum": [0.0, 2.5, 0.4],
        }
    )
    recent = pd.DataFrame(
        {
            "date": ["2026-10-19", "2026-10-20"],
            "temperature_2m_max": [14.2, 13.4],
            "temperature_2m_min": [4.4, 3.1],
            "apparent_temperature_max": [12.8, 12.0],
            "wind_speed_10m_max": [21.0, 16.0],
            "shortwave_radiation_sum": [10.5, 19.0],
            "et0_fao_evapotranspiration": [2.2, 3.6],
            "precipitation_sum": [8.0, 0.2],
        }
    )
    assembled = assemble_feature_frame([archive, recent])

    assert list(assembled.columns)[:8] == ["date", *FEATURE_COLUMNS]
    assert assembled["date"].is_monotonic_increasing
    assert assembled["date"].nunique() == len(assembled)
    # The recent source wins the overlapping 2026-10-19 row (8.0 mm, not 0.4 mm).
    october_19 = assembled.loc[assembled["date"] == pd.Timestamp("2026-10-19")].iloc[0]
    assert october_19["precipitation_sum"] == 8.0
    assert pd.notna(october_19["temperature_2m_max"])

    october_17 = assembled.loc[assembled["date"] == pd.Timestamp("2026-10-17")].iloc[0]
    october_18 = assembled.loc[assembled["date"] == pd.Timestamp("2026-10-18")].iloc[0]
    october_20 = assembled.loc[assembled["date"] == pd.Timestamp("2026-10-20")].iloc[0]
    assert int(october_17["target_rain_tomorrow"]) == 1  # next day 2.5 mm
    assert int(october_18["target_rain_tomorrow"]) == 1  # next day replaced by 8.0 mm
    assert int(october_19["target_rain_tomorrow"]) == 0  # next day 0.2 mm
    assert pd.isna(october_20["target_rain_tomorrow"])


def test_grid_search_training_and_metrics() -> None:
    features, target = _synthetic_training_set()
    assert set(np.unique(target)) == {0, 1}

    search = fit_grid_search(features, target)
    estimator = search.best_estimator_

    assert search.best_params_
    assert "classifier__C" in search.best_params_
    assert "classifier__class_weight" in search.best_params_
    assert "classifier__solver" in search.best_params_
    assert search.best_params_["classifier__C"] in [0.01, 0.1, 0.5, 1.0, 5.0, 10.0]
    assert search.best_params_["classifier__solver"] in ["lbfgs", "liblinear"]
    assert np.isfinite(search.best_score_)
    assert 0.0 <= float(search.best_score_) <= 1.0

    metrics = evaluate_on_holdout(estimator, features, target)
    for name in ("accuracy", "f1_score", "roc_auc"):
        assert 0.0 <= metrics[name] <= 1.0
    matrix = metrics["confusion_matrix"]
    assert len(matrix) == 2 and len(matrix[0]) == 2 and len(matrix[1]) == 2
    assert sum(sum(row) for row in matrix) == len(target)
    probabilities = estimator.predict_proba(features[:5])
    assert probabilities.shape == (5, 2)
    assert np.allclose(probabilities.sum(axis=1), 1.0, atol=1e-6)


def test_serialization_parity() -> None:
    features, target = _synthetic_training_set(rows=360, seed=7)
    estimator = fit_grid_search(features, target).best_estimator_
    weights = extract_model_weights(estimator, FEATURE_COLUMNS)

    assert weights["feature_names"] == FEATURE_COLUMNS
    assert len(weights["scaler_mean"]) == 7
    assert len(weights["scaler_scale"]) == 7
    assert len(weights["coefficients"]) == 7
    assert isinstance(weights["intercept"], float)
    assert weights["threshold"] == 0.5

    sklearn_probability = estimator.predict_proba(features)[:, 1]
    decoupled_probability = predict_positive_proba(features, weights)
    assert np.allclose(sklearn_probability, decoupled_probability, atol=1e-6, rtol=0.0)

    single = predict_positive_proba(features[0], weights)
    assert single.shape == (1,)
    assert np.allclose(single, sklearn_probability[0], atol=1e-6, rtol=0.0)
