#!/usr/bin/env python3
"""
One-time migration: import temperature_data.csv into weather.db

Usage:
    python migrate.py --csv /path/to/temperature_data.csv --db /path/to/weather.db

Safe to run more than once — duplicate rows are silently ignored.
"""

import argparse
import csv
import sqlite3
import sys
from datetime import datetime
from zoneinfo import ZoneInfo

SENSOR_MODEL   = "Oregon-THGR810"
VALID_CHANNELS = {0, 1, 2}
PACIFIC        = ZoneInfo("America/Los_Angeles")
BATCH_SIZE     = 5000

SCHEMA = """
CREATE TABLE IF NOT EXISTS readings (
    id          INTEGER PRIMARY KEY,
    channel     INTEGER NOT NULL,
    temp_c      REAL,
    humidity    REAL,
    battery_ok  INTEGER,
    received_at INTEGER NOT NULL  -- unix timestamp (UTC)
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


def parse_timestamp(s):
    """Parse an rtl_433 timestamp string (Pacific local time) → UTC unix int."""
    s = s.strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S"):
        try:
            dt = datetime.strptime(s, fmt).replace(tzinfo=PACIFIC)
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


def migrate(csv_path, db_path):
    con = sqlite3.connect(db_path)
    con.executescript(SCHEMA)
    con.commit()

    batch = []
    total = inserted = skipped = errors = 0

    print(f"Reading {csv_path} …")

    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)

        for row in reader:
            total += 1
            if total % 100_000 == 0:
                print(f"  {total:>10,} rows scanned   {inserted:>8,} inserted", flush=True)

            # Filter to sensor model and valid channels
            if row.get("model", "").strip() != SENSOR_MODEL:
                skipped += 1
                continue

            channel = safe_int(row.get("channel", ""))
            if channel not in VALID_CHANNELS:
                skipped += 1
                continue

            received_at = parse_timestamp(row.get("time", ""))
            if received_at is None:
                errors += 1
                continue

            temp_c     = safe_float(row.get("temperature_C"))
            humidity   = safe_float(row.get("humidity"))
            battery_ok = safe_int(row.get("battery_ok"))

            # Skip rows with no useful data
            if temp_c is None and humidity is None:
                skipped += 1
                continue

            batch.append((channel, temp_c, humidity, battery_ok, received_at))

            if len(batch) >= BATCH_SIZE:
                before = con.total_changes
                con.executemany(INSERT, batch)
                con.commit()
                inserted += con.total_changes - before
                batch.clear()

    # Flush remaining
    if batch:
        before = con.total_changes
        con.executemany(INSERT, batch)
        con.commit()
        inserted += con.total_changes - before

    con.close()

    print(f"\nMigration complete.")
    print(f"  Total rows scanned : {total:>10,}")
    print(f"  Inserted           : {inserted:>10,}")
    print(f"  Skipped (noise)    : {skipped:>10,}")
    print(f"  Parse errors       : {errors:>10,}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate rtl_433 CSV data to SQLite.")
    parser.add_argument("--csv", required=True, help="Path to temperature_data.csv")
    parser.add_argument("--db",  required=True, help="Path to weather.db (created if absent)")
    args = parser.parse_args()

    try:
        migrate(args.csv, args.db)
    except FileNotFoundError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
    except KeyboardInterrupt:
        print("\nInterrupted — partial data committed, safe to re-run.", file=sys.stderr)
        sys.exit(1)
