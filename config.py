#!/usr/bin/env python3
"""
config.py — shared configuration for data_writer.py, fetch_nws.py, and migrate.py.
"""

import os
from zoneinfo import ZoneInfo

# ── Sensor ────────────────────────────────────────────────────────
SENSOR_MODELS  = {"Oregon-THGR810"}
VALID_CHANNELS = {0, 1, 2}
CHANNEL_NAMES  = {0: "Back Porch", 1: "Front Porch", 2: "Side House"}
PACIFIC        = ZoneInfo("America/Los_Angeles")

# ── Paths ─────────────────────────────────────────────────────────
CSV_PATH     = os.environ.get("WEATHER_CSV",     "/weather-station/app/temperature_data.csv")
DB_PATH      = os.environ.get("WEATHER_DB",      "/weather-station/weather.db")
CURRENT_JSON = os.environ.get("WEATHER_CURRENT", "/weather-station/app/current.json")
NWS_JSON     = os.environ.get("WEATHER_NWS",     "/weather-station/app/nws_forecast.json")
STATE_PATH   = os.environ.get("WEATHER_STATE",   "/weather-station/csv_watcher_state.json")

# ── data_writer ───────────────────────────────────────────────────
POLL_INTERVAL     = 10       # seconds between CSV checks
GENERATE_INTERVAL = 20       # seconds between current.json writes
WINDOW_SECONDS    = 5 * 60  # 5-minute averaging window
STALE_SECONDS     = WINDOW_SECONDS + 30  # grace period beyond the averaging window
RECENT_COUNT      = 5        # readings shown in tooltip

# ── NWS ───────────────────────────────────────────────────────────
NWS_URL      = "https://api.weather.gov/gridpoints/MTR/113,56/forecast/hourly"
NWS_INTERVAL = 20 * 60      # seconds between NWS fetches
