#!/bin/sh
# Install required packages
apk add --no-cache --update tzdata rtl_433 libusb

# Set timezone
cp "/usr/share/zoneinfo/${TZ}" /etc/localtime
echo "${TZ}" > /etc/timezone

# Configure RTL-SDR
echo 'blacklist dvb_usb_rtl28xxu' > /etc/modprobe.d/blacklist-rtl.conf

# Make scripts executable
chmod +x /weather-station/entrypoint.sh /weather-station/tail_csv.sh

# Start the application
exec /weather-station/entrypoint.sh
