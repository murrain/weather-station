#!/bin/sh

while true; do
    if [ -f /weather-station/app/temperature_data.csv ]; then
        # Get headers (first line) and last 50 data lines
        head -n 1 /weather-station/app/temperature_data.csv > /weather-station/app/temperature_data_live.csv
        tail -n +2 /weather-station/app/temperature_data.csv | tail -n 50 >> /weather-station/app/temperature_data_live.csv
    fi
    sleep 20
done
