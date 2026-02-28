#!/bin/sh

set -eu

cleanup() {
    for pid in "${RTL_PID:-}" "${WRITER_PID:-}" "${HTTP_PID:-}" "${NWS_PID:-}"; do
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null || true
        fi
    done
}

trap cleanup INT TERM EXIT

rtl_433 -F csv:/weather-station/app/temperature_data.csv &
RTL_PID=$!

python3 /weather-station/data_writer.py &
WRITER_PID=$!

python3 -m http.server 8000 --directory /weather-station/app --bind 0.0.0.0 &
HTTP_PID=$!

python3 /weather-station/fetch_nws.py &
NWS_PID=$!

while true; do
    if ! kill -0 "$RTL_PID" 2>/dev/null; then
        echo "rtl_433 exited unexpectedly"
        exit 1
    fi
    if ! kill -0 "$WRITER_PID" 2>/dev/null; then
        echo "data_writer.py exited unexpectedly — restarting"
        python3 /weather-station/data_writer.py &
        WRITER_PID=$!
    fi
    if ! kill -0 "$HTTP_PID" 2>/dev/null; then
        echo "http.server exited unexpectedly"
        exit 1
    fi
    if ! kill -0 "$NWS_PID" 2>/dev/null; then
        echo "fetch_nws.py exited unexpectedly — restarting"
        python3 /weather-station/fetch_nws.py &
        NWS_PID=$!
    fi
    sleep 2
done
