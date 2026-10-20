"""Download Open-Meteo observations and upsert the Puno feature store.

Historical rows come from the archive API (730 days). The most recent week,
including today, comes from the forecast API so the archive lag does not leave
the feature store behind. The label is the next calendar day's precipitation.
"""

from __future__ import annotations

import logging
import time
from datetime import date, datetime, timedelta
from typing import Any

import numpy as np
import pandas as pd
import requests

from ml_pipeline.config import (
    DATE_COLUMN,
    FEATURE_COLUMNS,
    FORECAST_PAST_DAYS,
    HISTORICAL_DAYS,
    LATITUDE,
    LOCAL_TZ,
    LONGITUDE,
    OPEN_METEO_ARCHIVE_URL,
    OPEN_METEO_FORECAST_URL,
    RAIN_THRESHOLD_MM,
    TARGET_COLUMN,
    TIMEZONE,
    UPSERT_BATCH_SIZE,
    WEATHER_FEATURES_TABLE,
    require_supabase_credentials,
)

LOGGER = logging.getLogger("ml_pipeline.fetch_data")
DAILY_VARIABLES = ",".join(FEATURE_COLUMNS)


def local_today() -> date:
    return datetime.now(LOCAL_TZ).date()


def historical_window(today: date | None = None) -> tuple[date, date]:
    current = today or local_today()
    start = current - timedelta(days=HISTORICAL_DAYS)
    end = current - timedelta(days=1)
    return start, end


def _open_meteo_params(extra: dict[str, Any]) -> dict[str, Any]:
    return {
        "latitude": LATITUDE,
        "longitude": LONGITUDE,
        "daily": DAILY_VARIABLES,
        "timezone": TIMEZONE,
        "wind_speed_unit": "kmh",
        "precipitation_unit": "mm",
        **extra,
    }


def fetch_json(url: str, params: dict[str, Any], attempts: int = 3) -> dict[str, Any]:
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            response = requests.get(url, params=params, timeout=60)
            response.raise_for_status()
            payload = response.json()
            if "daily" not in payload:
                raise RuntimeError(f"Open-Meteo response has no daily block: {payload.get('reason')}")
            return payload
        except (requests.RequestException, RuntimeError, ValueError) as exc:
            last_error = exc
            LOGGER.warning("Open-Meteo attempt %s/%s failed: %s", attempt, attempts, exc)
            if attempt < attempts:
                time.sleep(2 * attempt)
    raise RuntimeError(f"Open-Meteo request failed for {url}") from last_error


def frame_from_open_meteo(payload: dict[str, Any]) -> pd.DataFrame:
    daily = payload["daily"]
    frame = pd.DataFrame({DATE_COLUMN: daily["time"]})
    for column in FEATURE_COLUMNS:
        if column not in daily:
            raise RuntimeError(f"Open-Meteo payload is missing '{column}'.")
        frame[column] = daily[column]
    frame[DATE_COLUMN] = pd.to_datetime(frame[DATE_COLUMN])
    return frame


def fetch_archive_frame(today: date | None = None) -> pd.DataFrame:
    """Archive coverage ends a few days behind the present. Step the end date back if needed."""
    start, end = historical_window(today)
    last_error: Exception | None = None
    for back in range(0, 8):
        window_end = end - timedelta(days=back)
        if window_end < start:
            break
        try:
            payload = fetch_json(
                OPEN_METEO_ARCHIVE_URL,
                _open_meteo_params(
                    {"start_date": start.isoformat(), "end_date": window_end.isoformat()}
                ),
            )
            frame = frame_from_open_meteo(payload)
            LOGGER.info(
                "Archive rows=%s window=%s..%s",
                len(frame),
                start.isoformat(),
                window_end.isoformat(),
            )
            return frame
        except Exception as exc:  # noqa: BLE001 - retry a shorter archive window, then raise
            last_error = exc
            LOGGER.warning("Archive window ending %s was rejected: %s", window_end.isoformat(), exc)
    raise RuntimeError("Unable to download the Open-Meteo archive window.") from last_error


def fetch_recent_frame() -> pd.DataFrame:
    payload = fetch_json(
        OPEN_METEO_FORECAST_URL,
        _open_meteo_params(
            {"past_days": FORECAST_PAST_DAYS, "forecast_days": 1}
        ),
    )
    frame = frame_from_open_meteo(payload)
    LOGGER.info("Recent forecast rows=%s", len(frame))
    return frame


def assemble_feature_frame(frames: list[pd.DataFrame]) -> pd.DataFrame:
    """Merge sources, fill gaps, and label rain on day t+1.

    Rows are concatenated in the order received. Duplicate dates keep the last
    source, so pass the archive first and the recent forecast second.
    The final row has no next-day precipitation yet, so its target stays null.
    """
    if not frames:
        raise ValueError("At least one weather frame is required.")
    frame = pd.concat(frames, ignore_index=True)
    missing = [column for column in [DATE_COLUMN, *FEATURE_COLUMNS] if column not in frame.columns]
    if missing:
        raise ValueError(f"Weather frame is missing columns: {missing}")

    frame[DATE_COLUMN] = pd.to_datetime(frame[DATE_COLUMN])
    frame = frame.drop_duplicates(subset=[DATE_COLUMN], keep="last").sort_values(DATE_COLUMN)
    frame = frame.set_index(DATE_COLUMN)
    for column in FEATURE_COLUMNS:
        frame[column] = pd.to_numeric(frame[column], errors="coerce")
    frame[FEATURE_COLUMNS] = frame[FEATURE_COLUMNS].interpolate(method="time", limit_direction="both")
    frame[FEATURE_COLUMNS] = frame[FEATURE_COLUMNS].ffill().bfill()
    if frame[FEATURE_COLUMNS].isna().any().any():
        empty = frame[FEATURE_COLUMNS].columns[frame[FEATURE_COLUMNS].isna().any()].tolist()
        raise RuntimeError(f"Feature columns still contain nulls after filling: {empty}")

    next_precipitation = frame["precipitation_sum"].shift(-1)
    target = pd.Series(np.nan, index=frame.index, dtype="float64")
    known = next_precipitation.notna()
    target.loc[known] = (next_precipitation.loc[known] >= RAIN_THRESHOLD_MM).astype(float)
    frame[TARGET_COLUMN] = target
    return frame.reset_index()


def records_for_upsert(frame: pd.DataFrame) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for row in frame.itertuples(index=False):
        payload: dict[str, Any] = {
            DATE_COLUMN: pd.Timestamp(getattr(row, DATE_COLUMN)).date().isoformat()
        }
        for column in FEATURE_COLUMNS:
            payload[column] = float(getattr(row, column))
        target = getattr(row, TARGET_COLUMN)
        if pd.isna(target):
            payload[TARGET_COLUMN] = None
        else:
            payload[TARGET_COLUMN] = int(target)
        records.append(payload)
    return records


def upsert_feature_records(client: Any, records: list[dict[str, Any]]) -> int:
    written = 0
    for start in range(0, len(records), UPSERT_BATCH_SIZE):
        batch = records[start : start + UPSERT_BATCH_SIZE]
        response = (
            client.table(WEATHER_FEATURES_TABLE)
            .upsert(batch, on_conflict=DATE_COLUMN)
            .execute()
        )
        error = getattr(response, "error", None)
        if error:
            raise RuntimeError(f"Supabase upsert failed: {error}")
        written += len(batch)
        LOGGER.info("Upserted weather_features rows %s-%s", start + 1, written)
    return written


def build_feature_store_frame(today: date | None = None) -> pd.DataFrame:
    archive = fetch_archive_frame(today)
    recent = fetch_recent_frame()
    return assemble_feature_frame([archive, recent])


def get_supabase_client() -> Any:
    from supabase import create_client

    url, key = require_supabase_credentials()
    return create_client(url, key)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    frame = build_feature_store_frame()
    records = records_for_upsert(frame)
    labeled = sum(record[TARGET_COLUMN] is not None for record in records)
    LOGGER.info(
        "Prepared %s daily rows (%s labeled, %s awaiting tomorrow).",
        len(records),
        labeled,
        len(records) - labeled,
    )
    client = get_supabase_client()
    written = upsert_feature_records(client, records)
    print(f"Feature store upsert complete: {written} rows in {WEATHER_FEATURES_TABLE}.")


if __name__ == "__main__":
    main()
