#!/bin/sh

set -eu

SOURCE_CSV="/weather-station/app/temperature_data.csv"
LIVE_CSV="/weather-station/app/temperature_data_live.csv"
TMP_CSV="${LIVE_CSV}.tmp"

while true; do
    if [ -f "$SOURCE_CSV" ]; then
        # Publish a snapshot atomically so readers never see partial content.
        head -n 1 "$SOURCE_CSV" > "$TMP_CSV"
        tail -n +2 "$SOURCE_CSV" | tail -n 50 >> "$TMP_CSV"
        mv "$TMP_CSV" "$LIVE_CSV"
    fi
    sleep 20
done
