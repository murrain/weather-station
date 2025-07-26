#!/bin/sh

# Start rtl433 in background, outputting to CSV
rtl_433 -F csv:/weather-station/app/temperature_data.csv &

# Start the tail script in background
/weather-station/tail_csv.sh &

# Start Python web server in foreground
# Start Python web server in foreground
python3 -m http.server 8000 --directory /weather-station/app --bind 0.0.0.0
