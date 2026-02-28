#!/bin/sh

set -eu

RTL_CSV="/weather-station/app/temperature_data.csv"
CSV_KEEP_DAYS=7

cleanup() {
    for pid in "${RTL_PID:-}" "${WRITER_PID:-}" "${HTTP_PID:-}" "${NWS_PID:-}" "${API_PID:-}" "${ROTATE_PID:-}"; do
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null || true
        fi
    done
}

trap cleanup INT TERM EXIT

rtl_433 -F "csv:${RTL_CSV}" &
RTL_PID=$!

python3 /weather-station/data_writer.py &
WRITER_PID=$!

python3 -m http.server 8000 --directory /weather-station/app --bind 0.0.0.0 &
HTTP_PID=$!

python3 /weather-station/fetch_nws.py &
NWS_PID=$!

python3 /weather-station/weather_api.py &
API_PID=$!

# Daily CSV rotation at Pacific midnight: sleep until next midnight, rotate,
# then repeat. Recalculates each iteration so DST transitions stay correct.
(
    while true; do
        NOW=$(date +%s)
        NEXT_MIDNIGHT=$(TZ="America/Los_Angeles" date -d "tomorrow 00:00:00" +%s)
        sleep $((NEXT_MIDNIGHT - NOW))
        DATED=$(TZ="America/Los_Angeles" date +%Y-%m-%d)
        mv "${RTL_CSV}" "/weather-station/app/temperature_data_${DATED}.csv" 2>/dev/null || true
        pkill rtl_433 2>/dev/null || true
        find /weather-station/app -name 'temperature_data_*.csv' \
            -mtime "+${CSV_KEEP_DAYS}" -delete 2>/dev/null || true
        echo "[rotate] CSV rotated to temperature_data_${DATED}.csv" >&2
    done
) &
ROTATE_PID=$!

while true; do
    if ! kill -0 "${RTL_PID}" 2>/dev/null; then
        echo "[watchdog] rtl_433 exited — restarting" >&2
        rtl_433 -F "csv:${RTL_CSV}" &
        RTL_PID=$!
    fi
    if ! kill -0 "${WRITER_PID}" 2>/dev/null; then
        echo "[watchdog] data_writer.py exited — restarting" >&2
        python3 /weather-station/data_writer.py &
        WRITER_PID=$!
    fi
    if ! kill -0 "${HTTP_PID}" 2>/dev/null; then
        echo "[watchdog] http.server exited" >&2
        exit 1
    fi
    if ! kill -0 "${NWS_PID}" 2>/dev/null; then
        echo "[watchdog] fetch_nws.py exited — restarting" >&2
        python3 /weather-station/fetch_nws.py &
        NWS_PID=$!
    fi
    if ! kill -0 "${API_PID}" 2>/dev/null; then
        echo "[watchdog] weather_api.py exited — restarting" >&2
        python3 /weather-station/weather_api.py &
        API_PID=$!
    fi
    sleep 2
done
