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

from config import (
    SENSOR_MODELS, VALID_CHANNELS, CHANNEL_NAMES, PACIFIC,
    CSV_PATH, DB_PATH, CURRENT_JSON, STATE_PATH,
    POLL_INTERVAL, GENERATE_INTERVAL, WINDOW_SECONDS, STALE_SECONDS, RECENT_COUNT,
)

TMP_JSON = CURRENT_JSON + ".tmp"

# ── Daily high tracker ────────────────────────────────────────────
_today_high_c:    float | None = None
_today_high_date: object       = None  # datetime.date


def update_today_high(temp_c: float | None) -> float | None:
    """Update and return today's sensor high. Resets automatically at midnight."""
    global _today_high_c, _today_high_date
    today = datetime.now(PACIFIC).date()
    if _today_high_date != today:
        _today_high_c    = temp_c
        _today_high_date = today
    elif temp_c is not None and (_today_high_c is None or temp_c > _today_high_c):
        _today_high_c = temp_c
    return _today_high_c

SCHEMA = """
CREATE TABLE IF NOT EXISTS readings (
    id          INTEGER PRIMARY KEY,
    model       TEXT    NOT NULL,
    sensor_id   INTEGER,
    channel     INTEGER NOT NULL,
    temp_c      REAL,
    humidity    REAL,
    battery_ok  INTEGER,
    received_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_readings_unique
    ON readings (model, channel, received_at);
CREATE INDEX IF NOT EXISTS idx_readings_channel_time
    ON readings (channel, received_at DESC);
"""

INSERT = """
INSERT OR IGNORE INTO readings (model, sensor_id, channel, temp_c, humidity, battery_ok, received_at)
VALUES (?, ?, ?, ?, ?, ?, ?)
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
        # Read header line separately so we can seek and parse rows manually.
        # Using readline() instead of DictReader lets us detect partial lines
        # (no trailing \n) so we never advance the offset past an incomplete
        # row that rtl_433 is still writing.
        f.seek(0)
        header_line = f.readline()
        header_end  = f.tell()
        fieldnames  = next(csv.reader([header_line]))

        seek_to    = max(state["offset"], header_end)
        new_offset = seek_to
        f.seek(seek_to)

        while True:
            line = f.readline()
            if not line:
                break
            if not line.endswith("\n"):
                # Partial line — rtl_433 is mid-write. Stop here; don't
                # advance offset past it so we re-read it next poll.
                break
            new_offset = f.tell()

            parsed = next(csv.reader([line]), None)
            if not parsed:
                continue
            row = dict(zip(fieldnames, parsed))

            model = row.get("model", "").strip()
            if model not in SENSOR_MODELS:
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
            sensor_id  = safe_int(row.get("id"))

            if temp_c is None and humidity is None:
                continue

            if temp_c is not None:
                update_today_high(temp_c)

            batch.append((model, sensor_id, channel, temp_c, humidity, battery_ok, received_at))

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

    trend    = round(sum(channel_trends) / len(channel_trends), 4) if channel_trends else None
    agg_temp = round(sum(agg_temps) / len(agg_temps), 2) if agg_temps else None

    payload = {
        "generatedAt": now,
        "channels":    channels,
        "aggregate": {
            "tempC":            agg_temp,
            "todayHighC":       round(_today_high_c, 2) if _today_high_c is not None else None,
            "humidity":         round(sum(agg_hums) / len(agg_hums), 2) if agg_hums else None,
            "tempTrendCPerMin": trend,
        },
    }

    with open(TMP_JSON, "w") as f:
        json.dump(payload, f)
    os.replace(TMP_JSON, CURRENT_JSON)


# ── Main loop ─────────────────────────────────────────────────────

def seed_today_high(con):
    """On boot, scan today's readings for the actual daily high."""
    today = datetime.now(PACIFIC).date()
    midnight = datetime(today.year, today.month, today.day, tzinfo=PACIFIC).timestamp()
    row = con.execute(
        "SELECT MAX(temp_c) FROM readings WHERE received_at >= ? AND channel IN (0,1,2)",
        (midnight,),
    ).fetchone()
    if row and row[0] is not None:
        update_today_high(row[0])
        print(f"[data_writer] Today's high from DB: {row[0]:.1f}°C", flush=True)


def main():
    con = sqlite3.connect(DB_PATH)
    con.execute("PRAGMA journal_mode=WAL")
    con.executescript(SCHEMA)
    con.commit()

    seed_today_high(con)
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
