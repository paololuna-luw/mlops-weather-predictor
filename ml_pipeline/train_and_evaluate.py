"""Train, evaluate, and hot-swap the Puno next-day rain classifier.

The live Next.js process never loads the joblib file. It reads `model_weights`
from the active `model_registry` row on every request. Publishing therefore
inserts the new active row before archiving older rows, so a reader always
finds an active model.
"""

from __future__ import annotations

import io
import logging
from datetime import datetime, timedelta
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, roc_auc_score
from sklearn.model_selection import GridSearchCV, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from ml_pipeline.config import (
    ALGORITHM_NAME,
    CV_FOLDS,
    DAILY_FORECASTS_TABLE,
    DATE_COLUMN,
    DECISION_THRESHOLD,
    FEATURE_COLUMNS,
    LOCAL_TZ,
    MODELS_BUCKET,
    MODEL_REGISTRY_TABLE,
    PARAM_GRID,
    RANDOM_STATE,
    TARGET_COLUMN,
    TRAIN_TEST_SIZE,
    WEATHER_FEATURES_TABLE,
)
from ml_pipeline.fetch_data import get_supabase_client
from ml_pipeline.inference_math import extract_model_weights, predict_positive_proba

LOGGER = logging.getLogger("ml_pipeline.train")
PARITY_ATOL = 1e-6


def build_pipeline() -> Pipeline:
    return Pipeline(
        steps=[
            ("scaler", StandardScaler()),
            (
                "classifier",
                LogisticRegression(max_iter=1000, random_state=RANDOM_STATE),
            ),
        ]
    )


def fit_grid_search(features: np.ndarray, target: np.ndarray) -> GridSearchCV:
    search = GridSearchCV(
        estimator=build_pipeline(),
        param_grid=PARAM_GRID,
        cv=CV_FOLDS,
        scoring="f1",
        n_jobs=-1,
        refit=True,
    )
    search.fit(features, target)
    return search


def evaluate_on_holdout(
    estimator: Any,
    features: np.ndarray,
    target: np.ndarray,
) -> dict[str, Any]:
    predicted = estimator.predict(features)
    probabilities = estimator.predict_proba(features)[:, 1]
    matrix = confusion_matrix(target, predicted, labels=[0, 1])
    return {
        "accuracy": float(accuracy_score(target, predicted)),
        "f1_score": float(f1_score(target, predicted, zero_division=0)),
        "roc_auc": float(roc_auc_score(target, probabilities)),
        "confusion_matrix": [[int(value) for value in row] for row in matrix.tolist()],
    }


def assert_serialization_parity(
    estimator: Any,
    features: np.ndarray,
    model_weights: dict[str, Any],
    atol: float = PARITY_ATOL,
) -> None:
    sklearn_probability = estimator.predict_proba(features)[:, 1]
    math_probability = predict_positive_proba(features, model_weights)
    if not np.allclose(sklearn_probability, math_probability, atol=atol, rtol=0.0):
        max_gap = float(np.max(np.abs(sklearn_probability - math_probability)))
        raise AssertionError(
            f"Inference parity failed. Max absolute gap {max_gap:.3e} exceeds {atol:.1e}."
        )


def version_stamp(moment: datetime | None = None) -> str:
    current = moment or datetime.now(LOCAL_TZ)
    return current.strftime("v1.0.%Y%m%d_%H%M%S")


def _page_table(client: Any, table: str, order_column: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    page_size = 1000
    offset = 0
    while True:
        response = (
            client.table(table)
            .select("*")
            .order(order_column)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        batch = list(response.data or [])
        rows.extend(batch)
        if len(batch) < page_size:
            return rows
        offset += page_size


def load_feature_store(client: Any) -> pd.DataFrame:
    rows = _page_table(client, WEATHER_FEATURES_TABLE, DATE_COLUMN)
    if not rows:
        raise RuntimeError(
            "weather_features is empty. Run `python -m ml_pipeline.fetch_data` before training."
        )
    frame = pd.DataFrame(rows)
    frame[DATE_COLUMN] = pd.to_datetime(frame[DATE_COLUMN])
    frame = frame.sort_values(DATE_COLUMN).drop_duplicates(subset=[DATE_COLUMN], keep="last")
    for column in FEATURE_COLUMNS:
        frame[column] = pd.to_numeric(frame[column], errors="coerce")
    return frame.reset_index(drop=True)


def split_supervised_and_today(frame: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    """Labeled history trains the model. The latest row is today's forecast input."""
    if frame.empty:
        raise RuntimeError("The feature store frame is empty.")
    today = frame.iloc[-1]
    labeled = frame[frame[TARGET_COLUMN].notna()].copy()
    labeled[TARGET_COLUMN] = labeled[TARGET_COLUMN].astype(int)
    if labeled[FEATURE_COLUMNS].isna().any().any():
        raise RuntimeError("Labeled feature rows contain null weather values.")
    if today[FEATURE_COLUMNS].isna().any():
        raise RuntimeError("The latest feature-store row has null weather values, so tomorrow cannot be scored.")
    classes = labeled[TARGET_COLUMN].nunique()
    if classes < 2:
        raise RuntimeError("Training requires both rain and dry days in weather_features.")
    if len(labeled) < CV_FOLDS * 4:
        raise RuntimeError(
            f"Training requires at least {CV_FOLDS * 4} labeled days. Found {len(labeled)}."
        )
    return labeled, today


def json_safe(value: Any) -> Any:
    """Convert NumPy scalars so the Supabase client can encode JSONB columns."""
    if isinstance(value, dict):
        return {str(key): json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [json_safe(item) for item in value]
    if isinstance(value, np.ndarray):
        return json_safe(value.tolist())
    if isinstance(value, np.floating):
        return float(value)
    if isinstance(value, np.integer):
        return int(value)
    return value


def hyperparameters_payload(search: GridSearchCV) -> dict[str, Any]:
    payload: dict[str, Any] = {}
    for key, value in search.best_params_.items():
        payload[key] = value
    payload["cv_folds"] = CV_FOLDS
    payload["scoring"] = "f1"
    payload["best_cv_f1"] = float(search.best_score_)
    payload["test_size"] = TRAIN_TEST_SIZE
    payload["random_state"] = RANDOM_STATE
    return payload


def _public_url(bucket: Any, object_name: str) -> str:
    public = bucket.get_public_url(object_name)
    if isinstance(public, dict):
        public = public.get("publicUrl") or public.get("publicURL") or ""
    return str(public).strip().rstrip("?")


def upload_joblib(client: Any, estimator: Any, version: str) -> str:
    buffer = io.BytesIO()
    joblib.dump(estimator, buffer, compress=3)
    payload = buffer.getvalue()
    bucket = client.storage.from_(MODELS_BUCKET)
    versioned_name = f"model_{version}.joblib"
    latest_name = "model_latest.joblib"
    options = {"content-type": "application/octet-stream", "upsert": "true"}
    for object_name in (versioned_name, latest_name):
        try:
            bucket.upload(object_name, payload, file_options=options)
        except Exception as exc:  # noqa: BLE001 - storage clients differ on the upsert path
            message = str(exc).lower()
            if "exist" in message or "duplicate" in message:
                bucket.update(
                    object_name,
                    payload,
                    file_options={"content-type": "application/octet-stream"},
                )
            else:
                raise
        LOGGER.info("Uploaded %s/%s (%s bytes)", MODELS_BUCKET, object_name, len(payload))
    return _public_url(bucket, versioned_name)


def publish_model_row(client: Any, row: dict[str, Any]) -> dict[str, Any]:
    """Insert the new active model, then archive every other registry row."""
    inserted = client.table(MODEL_REGISTRY_TABLE).insert(row).execute()
    records = list(inserted.data or [])
    if not records:
        raise RuntimeError("model_registry insert returned no row.")
    new_row = records[0]
    (
        client.table(MODEL_REGISTRY_TABLE)
        .update({"is_active": False})
        .neq("id", new_row["id"])
        .execute()
    )
    return new_row


def insert_daily_forecast(
    client: Any,
    *,
    forecast_for: str,
    version: str,
    will_rain: bool,
    probability: float,
    features: dict[str, float],
) -> None:
    (
        client.table(DAILY_FORECASTS_TABLE)
        .insert(
            {
                "forecast_for_date": forecast_for,
                "model_version": version,
                "will_rain": will_rain,
                "rain_probability": probability,
                "input_features": features,
            }
        )
        .execute()
    )


def train_publish_and_forecast(client: Any | None = None) -> dict[str, Any]:
    supabase = client or get_supabase_client()
    frame = load_feature_store(supabase)
    labeled, today = split_supervised_and_today(frame)
    feature_matrix = labeled[FEATURE_COLUMNS].to_numpy(dtype=float)
    target = labeled[TARGET_COLUMN].to_numpy(dtype=int)

    features_train, features_test, target_train, target_test = train_test_split(
        feature_matrix,
        target,
        test_size=TRAIN_TEST_SIZE,
        stratify=target,
        random_state=RANDOM_STATE,
    )
    LOGGER.info(
        "Training rows=%s test rows=%s labeled days=%s",
        len(features_train),
        len(features_test),
        len(labeled),
    )
    search = fit_grid_search(features_train, target_train)
    estimator = search.best_estimator_
    metrics = evaluate_on_holdout(estimator, features_test, target_test)
    weights = extract_model_weights(estimator, FEATURE_COLUMNS, DECISION_THRESHOLD)
    today_vector = today[FEATURE_COLUMNS].to_numpy(dtype=float).reshape(1, -1)
    holdout_sample = features_test[:25]
    if holdout_sample.ndim == 1:
        holdout_sample = holdout_sample.reshape(1, -1)
    parity_sample = np.vstack([holdout_sample, today_vector])
    assert_serialization_parity(estimator, parity_sample, weights)

    version = version_stamp()
    storage_path = upload_joblib(supabase, estimator, version)
    registry_row = {
        "version": version,
        "algorithm": ALGORITHM_NAME,
        "best_hyperparameters": hyperparameters_payload(search),
        "accuracy": metrics["accuracy"],
        "f1_score": metrics["f1_score"],
        "roc_auc": metrics["roc_auc"],
        "confusion_matrix": metrics["confusion_matrix"],
        "dataset_rows": int(len(labeled)),
        "model_weights": weights,
        "storage_path": storage_path,
        "is_active": True,
    }
    published = publish_model_row(supabase, json_safe(registry_row))

    probability = float(predict_positive_proba(today_vector, weights)[0])
    will_rain = probability >= DECISION_THRESHOLD
    forecast_day = (pd.Timestamp(today[DATE_COLUMN]) + timedelta(days=1)).date().isoformat()
    feature_payload = {
        column: float(today[column]) for column in FEATURE_COLUMNS
    }
    insert_daily_forecast(
        supabase,
        forecast_for=forecast_day,
        version=version,
        will_rain=will_rain,
        probability=probability,
        features=feature_payload,
    )
    summary = {
        "version": version,
        "registry_id": published.get("id"),
        "metrics": metrics,
        "best_hyperparameters": registry_row["best_hyperparameters"],
        "dataset_rows": int(len(labeled)),
        "storage_path": storage_path,
        "forecast_for_date": forecast_day,
        "will_rain": will_rain,
        "rain_probability": probability,
    }
    LOGGER.info("Published %s and forecast %s rain=%s p=%.4f", version, forecast_day, will_rain, probability)
    return summary


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    summary = train_publish_and_forecast()
    metrics = summary["metrics"]
    print(
        "Model published: "
        f"{summary['version']} | "
        f"accuracy={metrics['accuracy']:.4f} "
        f"f1={metrics['f1_score']:.4f} "
        f"roc_auc={metrics['roc_auc']:.4f} | "
        f"forecast {summary['forecast_for_date']} "
        f"will_rain={summary['will_rain']} "
        f"p={summary['rain_probability']:.4f}"
    )
    print(f"Artifact: {summary['storage_path']}")


if __name__ == "__main__":
    main()
