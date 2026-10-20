"""Central configuration for the Puno rain classifier.

Environment variables are read from the repository root `.env` file.
The service-role key never belongs in the Next.js browser bundle.
"""

from __future__ import annotations

import os
from pathlib import Path
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent
PIPELINE_DIR = Path(__file__).resolve().parent

load_dotenv(ROOT_DIR / ".env")
load_dotenv(PIPELINE_DIR / ".env")

CITY = "Puno"
COUNTRY = "Peru"
LATITUDE = -15.8402
LONGITUDE = -70.0219
TIMEZONE = "America/Lima"
LOCAL_TZ = ZoneInfo(TIMEZONE)

RAIN_THRESHOLD_MM = 1.0
HISTORICAL_DAYS = 730
FORECAST_PAST_DAYS = 7
UPSERT_BATCH_SIZE = 500
TRAIN_TEST_SIZE = 0.2
RANDOM_STATE = 42
CV_FOLDS = 5
DECISION_THRESHOLD = 0.5
ALGORITHM_NAME = "LogisticRegression (GridSearchCV)"

OPEN_METEO_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"

FEATURE_COLUMNS: list[str] = [
    "temperature_2m_max",
    "temperature_2m_min",
    "apparent_temperature_max",
    "wind_speed_10m_max",
    "shortwave_radiation_sum",
    "et0_fao_evapotranspiration",
    "precipitation_sum",
]

FEATURE_UNITS: dict[str, str] = {
    "temperature_2m_max": "°C",
    "temperature_2m_min": "°C",
    "apparent_temperature_max": "°C",
    "wind_speed_10m_max": "km/h",
    "shortwave_radiation_sum": "MJ/m^2",
    "et0_fao_evapotranspiration": "mm",
    "precipitation_sum": "mm",
}

TARGET_COLUMN = "target_rain_tomorrow"
DATE_COLUMN = "date"

PARAM_GRID: dict[str, list[object]] = {
    "classifier__C": [0.01, 0.1, 0.5, 1.0, 5.0, 10.0],
    "classifier__class_weight": [None, "balanced"],
    "classifier__solver": ["lbfgs", "liblinear"],
}

WEATHER_FEATURES_TABLE = "weather_features"
MODEL_REGISTRY_TABLE = "model_registry"
DAILY_FORECASTS_TABLE = "daily_forecasts"
MODELS_BUCKET = "models"


def supabase_url() -> str:
    """Return the project URL, accepting the REST form written in the local notes."""
    raw = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
    for suffix in ("/rest/v1", "/rest/v1/"):
        if raw.endswith(suffix.rstrip("/")):
            raw = raw[: -len(suffix.rstrip("/"))]
            break
    return raw


def supabase_service_role_key() -> str:
    return os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()


def require_supabase_credentials() -> tuple[str, str]:
    url = supabase_url()
    key = supabase_service_role_key()
    if not url or not key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required. "
            "Copy them from 'credenciales y datos importantes pre iniciar.txt' into the root .env file."
        )
    return url, key
