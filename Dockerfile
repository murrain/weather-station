FROM python:3.9-alpine

RUN apk add --no-cache tzdata rtl_433 libusb usbutils

WORKDIR /weather-station
