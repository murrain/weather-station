#!/usr/bin/env python3
"""
data_writer.py — watches temperature_data.csv for new rows, imports them
into SQLite, and regenerates current.json on a fixed interval.

Tracks file offset and inode so it resumes correctly after restarts and
handles rtl_433 recreating the file cleanly.
"""

import csv
import json
import os
import sqlite3
import sys
import time
from datetime import datetime
from zoneinfo import ZoneInfo

SENSOR_MODEL      = "Oregon-THGR810"
VALID_CHANNELS    = {0, 1, 2}
CHANNEL_NAMES     = {0: "Back Porch", 1: "Front Porch", 2: "Side House"}
PACIFIC           = ZoneInfo("America/Los_Angeles")

CSV_PATH          = os.environ.get("WEATHER_CSV",     "/weather-station/app/temperature_data.csv")
DB_PATH           = os.environ.get("WEATHER_DB",      "/weather-station/app/weather.db")
OUTPUT_JSON       = os.environ.get("WEATHER_CURRENT", "/weather-station/app/current.json")
STATE_PATH        = os.environ.get("WEATHER_STATE",   "/weather-station/app/csv_watcher_state.json")
TMP_JSON          = OUTPUT_JSON + ".tmp"

POLL_INTERVAL     = 10       # seconds between CSV checks
GENERATE_INTERVAL = 20       # seconds between current.json writes
WINDOW_SECONDS    = 5 * 60  # 5-minute averaging window
STALE_SECONDS     = WINDOW_SECONDS + 30
RECENT_COUNT      = 5        # readings shown in tooltip

SCHEMA = """
CREATE TABLE IF NOT EXISTS readings (
    id          INTEGER PRIMARY KEY,
    channel     INTEGER NOT NULL,
    temp_c      REAL,
    humidity    REAL,
    battery_ok  INTEGER,
    received_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_readings_unique
    ON readings (channel, received_at);
CREATE INDEX IF NOT EXISTS idx_readings_channel_time
    ON readings (channel, received_at DESC);
"""

INSERT = """
INSERT OR IGNORE INTO readings (channel, temp_c, humidity, battery_ok, received_at)
VALUES (?, ?, ?, ?, ?)
"""


# ── State persistence ─────────────────────────────────────────────

def load_state():
    try:
        with open(STATE_PATH) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"offset": 0, "inode": None}


def save_state(state):
    tmp = STATE_PATH + ".tmp"
    with open(tmp, "w") as f:
        json.dump(state, f)
    os.replace(tmp, STATE_PATH)


# ── Timestamp parsing ─────────────────────────────────────────────

def parse_timestamp(s):
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S"):
        try:
            dt = datetime.strptime(s.strip(), fmt).replace(tzinfo=PACIFIC)
            return int(dt.timestamp())
        except ValueError:
            continue
    return None


def safe_float(s):
    try:
        return float(s) if s and s.strip() else None
    except ValueError:
        return None


def safe_int(s):
    try:
        return int(s) if s and s.strip() else None
    except ValueError:
        return None


# ── CSV import ────────────────────────────────────────────────────

def import_new_rows(con, state):
    try:
        stat = os.stat(CSV_PATH)
    except FileNotFoundError:
        return state

    current_inode = stat.st_ino
    current_size  = stat.st_size

    # File was replaced (rtl_433 restarted) — reset and re-read from top
    if current_inode != state.get("inode"):
        print(f"[data_writer] CSV file changed (new inode) — resetting offset", flush=True)
        state = {"offset": 0, "inode": current_inode}

    if current_size <= state["offset"]:
        return state  # no new data

    batch = []

    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        # Read header line separately so we can seek before building DictReader.
        # Constructing DictReader first buffers data and makes seek unreliable.
        f.seek(0)
        header_line = f.readline()
        header_end  = f.tell()
        fieldnames  = next(csv.reader([header_line]))

        seek_to = max(state["offset"], header_end)
        f.seek(seek_to)

        reader = csv.DictReader(f, fieldnames=fieldnames)

        for row in reader:
            if row.get("model", "").strip() != SENSOR_MODEL:
                continue

            channel = safe_int(row.get("channel", ""))
            if channel not in VALID_CHANNELS:
                continue

            received_at = parse_timestamp(row.get("time", ""))
            if received_at is None:
                continue

            temp_c     = safe_float(row.get("temperature_C"))
            humidity   = safe_float(row.get("humidity"))
            battery_ok = safe_int(row.get("battery_ok"))

            if temp_c is None and humidity is None:
                continue

            batch.append((channel, temp_c, humidity, battery_ok, received_at))

        new_offset = f.tell()

    if batch:
        con.executemany(INSERT, batch)
        con.commit()

    state["offset"] = new_offset
    state["inode"]  = current_inode
    return state


# ── current.json generation ───────────────────────────────────────

def generate_current(con):
    now          = int(time.time())
    window_start = now - WINDOW_SECONDS
    stale_cutoff = now - STALE_SECONDS

    channels       = {}
    channel_trends = []

    for ch in sorted(VALID_CHANNELS):
        latest = con.execute(
            "SELECT received_at, battery_ok FROM readings WHERE channel = ? ORDER BY received_at DESC LIMIT 1",
            (ch,)
        ).fetchone()

        if latest is None:
            continue

        last_seen, battery_ok = latest
        online = last_seen >= stale_cutoff

        avg_temp = con.execute(
            "SELECT AVG(temp_c) FROM readings WHERE channel = ? AND received_at >= ? AND temp_c IS NOT NULL",
            (ch, window_start)
        ).fetchone()[0]

        avg_hum = con.execute(
            "SELECT AVG(humidity) FROM readings WHERE channel = ? AND received_at >= ? AND humidity IS NOT NULL",
            (ch, window_start)
        ).fetchone()[0]

        recent_rows = con.execute(
            "SELECT received_at, temp_c, humidity FROM readings WHERE channel = ? ORDER BY received_at DESC LIMIT ?",
            (ch, RECENT_COUNT)
        ).fetchall()

        recent = [
            {"time": r[0], "tempC": r[1], "humidity": r[2]}
            for r in recent_rows
        ]

        # Compute per-channel trend; collect for aggregate average
        window_rows = con.execute(
            "SELECT received_at, temp_c FROM readings WHERE channel = ? AND received_at >= ? AND temp_c IS NOT NULL ORDER BY received_at",
            (ch, window_start)
        ).fetchall()
        if len(window_rows) >= 2:
            oldest, newest = window_rows[0], window_rows[-1]
            elapsed_min = (newest[0] - oldest[0]) / 60
            if elapsed_min >= 0.5:
                channel_trends.append((newest[1] - oldest[1]) / elapsed_min)

        channels[str(ch)] = {
            "name":           CHANNEL_NAMES[ch],
            "tempC":          round(avg_temp, 2) if avg_temp is not None else None,
            "humidity":       round(avg_hum,  2) if avg_hum  is not None else None,
            "batteryOk":      bool(battery_ok) if battery_ok is not None else None,
            "online":         online,
            "lastSeen":       last_seen,
            "recentReadings": recent,
        }

    online_ch = [v for v in channels.values() if v["online"]]
    agg_temps = [v["tempC"]    for v in online_ch if v["tempC"]    is not None]
    agg_hums  = [v["humidity"] for v in online_ch if v["humidity"] is not None]

    trend = round(sum(channel_trends) / len(channel_trends), 4) if channel_trends else None

    payload = {
        "generatedAt": now,
        "channels":    channels,
        "aggregate": {
            "tempC":            round(sum(agg_temps) / len(agg_temps), 2) if agg_temps else None,
            "humidity":         round(sum(agg_hums)  / len(agg_hums),  2) if agg_hums  else None,
            "tempTrendCPerMin": trend,
        },
    }

    with open(TMP_JSON, "w") as f:
        json.dump(payload, f)
    os.replace(TMP_JSON, OUTPUT_JSON)


# ── Main loop ─────────────────────────────────────────────────────

def main():
    con = sqlite3.connect(DB_PATH)
    con.executescript(SCHEMA)
    con.execute("PRAGMA journal_mode=WAL")
    con.commit()

    state          = load_state()
    last_generated = 0.0

    while True:
        state = import_new_rows(con, state)
        save_state(state)

        now = time.time()
        if now - last_generated >= GENERATE_INTERVAL:
            try:
                generate_current(con)
                last_generated = now
            except Exception as e:
                print(f"[data_writer] generation failed: {e}", file=sys.stderr)

        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
