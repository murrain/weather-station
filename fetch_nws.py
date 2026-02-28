#!/usr/bin/env python3
"""
NWS forecast poller for weather-station.

Fetches the current hourly forecast from api.weather.gov every 20 minutes
and writes a small JSON file that the browser reads as a static asset.
Runs as a daemon inside the Docker container alongside rtl_433 and data_writer.py.
"""

import json
import os
import time
import urllib.error
import urllib.request

from config import NWS_URL, NWS_JSON, NWS_INTERVAL

TMP_FILE = NWS_JSON + ".tmp"

HEADERS = {
    "User-Agent": "personal-weather-station/1.0 (home dashboard; contact: local)",
    "Accept": "application/geo+json",
}


def parse_wind_speed_mph(wind_str):
    """Parse NWS wind speed string to a number.

    Handles: "3 mph", "12 mph", "12 to 18 mph" (returns average).
    Returns 0 on parse failure.
    """
    if not wind_str:
        return 0
    parts = wind_str.lower().replace("mph", "").strip().split("to")
    try:
        nums = [float(p.strip()) for p in parts if p.strip()]
        return sum(nums) / len(nums) if nums else 0
    except ValueError:
        return 0


def fetch_and_write():
    req = urllib.request.Request(NWS_URL, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read()
        data = json.loads(raw)
    except urllib.error.HTTPError as exc:
        print(f"[nws] HTTP {exc.code}: {exc.reason} — keeping existing file", flush=True)
        return
    except urllib.error.URLError as exc:
        print(f"[nws] Network error: {exc.reason} — keeping existing file", flush=True)
        return
    except Exception as exc:
        print(f"[nws] Unexpected error: {exc} — keeping existing file", flush=True)
        return

    periods = data.get("properties", {}).get("periods", [])
    if not periods:
        print("[nws] Response had no periods — keeping existing file", flush=True)
        return

    current = periods[0]
    precip = current.get("probabilityOfPrecipitation") or {}
    wind_speed_mph = parse_wind_speed_mph(current.get("windSpeed", ""))

    payload = {
        "fetchedAt": time.time(),
        "current": {
            "windSpeedMph": wind_speed_mph,
            "windDirection": current.get("windDirection", ""),
            "probabilityOfPrecipitation": precip.get("value") if precip.get("value") is not None else 0,
            "shortForecast": current.get("shortForecast", ""),
            "isDaytime": current.get("isDaytime", True),
        },
    }

    try:
        with open(TMP_FILE, "w") as f:
            json.dump(payload, f)
        os.replace(TMP_FILE, NWS_JSON)
        print(
            f"[nws] Updated: {payload['current']['shortForecast']}"
            f" | wind {wind_speed_mph:.0f} mph {payload['current']['windDirection']}"
            f" | precip {payload['current']['probabilityOfPrecipitation']}%",
            flush=True,
        )
    except OSError as exc:
        print(f"[nws] Failed to write output file: {exc}", flush=True)


if __name__ == "__main__":
    print("[nws] Starting NWS forecast poller", flush=True)
    fetch_and_write()
    while True:
        time.sleep(NWS_INTERVAL)
        fetch_and_write()
