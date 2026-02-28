#!/bin/sh

set -e

echo "Installing runtime dependencies..."
apk add --no-cache --update tzdata rtl_433 libusb usbutils

echo "Waiting for RTL2838 device (0bda:2838)..."

while true; do
    if lsusb | grep -q "0bda:2838"; then
        echo "RTL device detected."
        break
    fi
    sleep 2
done

echo "Making scripts executable..."
chmod +x /weather-station/entrypoint.sh /weather-station/tail_csv.sh

echo "Starting weather station..."
exec /weather-station/entrypoint.sh
