#!/usr/bin/env python3
"""
weather_api.py — OpenWeatherMap-compatible local weather API.

Endpoints:
  GET /data/3.0/onecall    OWM One Call format (current + 7-day daily)
  GET /data/2.5/weather    Current conditions only (OWM 2.5 format)
  GET /api/v1/current      Native: raw sensor + NWS data
  GET /api/v1/forecast     Native: 7-day daily array

Query params:
  units=metric|imperial|standard  (default: metric)

Current temp/humidity come from local sensors (current.json).
Wind, sky condition, and precip come from nws_forecast.json.
7-day forecast is fetched from the NWS daily forecast API and cached
in memory for 20 minutes.
"""

import json
import math
import time
import urllib.error
import urllib.request
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from config import (
    API_PORT,
    CURRENT_JSON,
    LOCATION_LAT,
    LOCATION_LON,
    LOCATION_NAME,
    NWS_DAILY_URL,
    NWS_JSON,
    PACIFIC,
    parse_wind_mph,
)

HEADERS = {
    "User-Agent": "personal-weather-station/1.0 (home dashboard; contact: local)",
    "Accept":     "application/geo+json",
}

DAILY_CACHE_TTL = 20 * 60  # seconds
_daily_cache: dict = {"fetchedAt": 0, "periods": []}

WIND_DEG = {
    "N": 0,   "NNE": 22,  "NE": 45,  "ENE": 67,
    "E": 90,  "ESE": 112, "SE": 135, "SSE": 157,
    "S": 180, "SSW": 202, "SW": 225, "WSW": 247,
    "W": 270, "WNW": 292, "NW": 315, "NNW": 337,
}


# ── Unit conversions ──────────────────────────────────────────────────

def f_to_c(f):
    return (f - 32) * 5 / 9


def apply_temp(c, units):
    if units == "imperial":
        return round(c * 9 / 5 + 32, 2)
    if units == "standard":
        return round(c + 273.15, 2)
    return round(c, 2)


def apply_wind(ms, units):
    """Wind speed: m/s for metric/standard, mph for imperial."""
    if units == "imperial":
        return round(ms * 2.23694, 2)
    return round(ms, 2)


# ── Derived calculations ──────────────────────────────────────────────

def dew_point_c(temp_c, humidity):
    a, b  = 17.625, 243.04
    alpha = math.log(max(humidity, 0.01) / 100) + (a * temp_c) / (b + temp_c)
    return (b * alpha) / (a - alpha)


def feels_like_c(temp_c, humidity, wind_ms):
    wind_kph = wind_ms * 3.6
    if temp_c < 10 and wind_kph > 4.8:
        v = wind_kph ** 0.16
        return 13.12 + 0.6215 * temp_c - 11.37 * v + 0.3965 * temp_c * v
    if temp_c > 27 and humidity > 40:
        T, H = temp_c, humidity
        return (
            -8.78469475556 + 1.61139411 * T + 2.3385248 * H
            - 0.14611605 * T * H  - 0.012308094 * T * T
            - 0.016424828 * H * H + 0.002211732 * T * T * H
            + 0.00072546  * T * H * H - 0.000003582 * T * T * H * H
        )
    return temp_c


# ── NWS helpers ───────────────────────────────────────────────────────


def wind_dir_deg(direction):
    return WIND_DEG.get((direction or "").upper().strip(), 0)


def sky_to_owm(short_forecast, is_daytime=True):
    """Map an NWS shortForecast string to an OWM weather condition object."""
    s   = (short_forecast or "").lower()
    sfx = "d" if is_daytime else "n"
    if "thunder" in s:
        return {"id": 211, "main": "Thunderstorm", "description": short_forecast, "icon": f"11{sfx}"}
    if "heavy rain" in s or "heavy shower" in s:
        return {"id": 502, "main": "Rain",         "description": short_forecast, "icon": f"10{sfx}"}
    if "rain" in s or "shower" in s or "drizzle" in s:
        return {"id": 500, "main": "Rain",         "description": short_forecast, "icon": f"10{sfx}"}
    if "snow" in s or "flurr" in s or "sleet" in s:
        return {"id": 601, "main": "Snow",         "description": short_forecast, "icon": f"13{sfx}"}
    if "fog" in s or "mist" in s:
        return {"id": 741, "main": "Fog",          "description": short_forecast, "icon": f"50{sfx}"}
    if "overcast" in s:
        return {"id": 804, "main": "Clouds",       "description": short_forecast, "icon": f"04{sfx}"}
    if "mostly cloudy" in s:
        return {"id": 803, "main": "Clouds",       "description": short_forecast, "icon": f"04{sfx}"}
    if "partly cloudy" in s or "mostly clear" in s:
        return {"id": 802, "main": "Clouds",       "description": short_forecast, "icon": f"02{sfx}"}
    if "sunny" in s or "clear" in s or "fair" in s:
        return {"id": 800, "main": "Clear",        "description": short_forecast, "icon": f"01{sfx}"}
    return {"id": 800, "main": "Clear", "description": short_forecast or "Unknown", "icon": f"01{sfx}"}


def clouds_pct(short_forecast):
    s = (short_forecast or "").lower()
    if "overcast"     in s:                              return 100
    if "mostly cloudy" in s:                             return 80
    if "partly cloudy" in s or "mostly clear" in s:     return 40
    if "sunny" in s or "clear" in s or "fair" in s:     return 5
    if "cloud" in s:                                     return 60
    return 25


# ── Astronomical calculations ─────────────────────────────────────────

def _d2000(dt_utc):
    """Days since J2000.0 (2000-Jan-1 12:00 UTC)."""
    j2000 = datetime(2000, 1, 1, 12, 0, tzinfo=timezone.utc)
    return (dt_utc - j2000).total_seconds() / 86400.0


def sun_rise_set(lat, lon, date_obj):
    """
    Sunrise/sunset using the USNO algorithm. Accurate to ~1 minute.
    Returns (sunrise_epoch_utc, sunset_epoch_utc); returns (0, 0) on polar anomaly.
    """
    N        = date_obj.timetuple().tm_yday
    lng_hour = lon / 15.0
    results  = []

    for is_rise in (True, False):
        t  = N + ((6 - lng_hour) / 24.0 if is_rise else (18 - lng_hour) / 24.0)
        M  = (0.9856 * t - 3.289) % 360.0
        L  = (M + 1.916 * math.sin(math.radians(M))
              + 0.020 * math.sin(math.radians(2 * M))
              + 282.634) % 360.0
        RA = math.degrees(math.atan(0.91764 * math.tan(math.radians(L)))) % 360.0
        Lq, RAq = (int(L / 90)) * 90, (int(RA / 90)) * 90
        RA  = (RA + (Lq - RAq)) / 15.0

        sinDec = 0.39782 * math.sin(math.radians(L))
        cosDec = math.cos(math.asin(sinDec))
        cosH   = (math.cos(math.radians(90.833)) - sinDec * math.sin(math.radians(lat))) / (cosDec * math.cos(math.radians(lat)))
        if cosH > 1 or cosH < -1:
            results.append(0)
            continue

        H      = (360.0 - math.degrees(math.acos(cosH))) / 15.0 if is_rise else math.degrees(math.acos(cosH)) / 15.0
        T_mean = H + RA - 0.06571 * t - 6.622
        ut     = (T_mean - lng_hour) % 24.0

        midnight = datetime(date_obj.year, date_obj.month, date_obj.day, tzinfo=timezone.utc)
        results.append(int(midnight.timestamp() + ut * 3600))

    return results[0], results[1]


def _moon_equatorial(d):
    """
    Moon RA and declination (degrees) for d days since J2000.0.
    Simplified algorithm; accurate to ~1 degree.
    """
    N = (125.1228 - 0.0529538083  * d) % 360   # Long of ascending node
    w = (318.0634 + 0.1643573223  * d) % 360   # Arg of perigee
    M = (115.3654 + 13.0649929509 * d) % 360   # Mean anomaly
    e, i = 0.054900, 5.1454                     # Eccentricity, inclination

    # Eccentric anomaly via Newton's method
    E = M + math.degrees(e * math.sin(math.radians(M))) * (1 + e * math.cos(math.radians(M)))
    for _ in range(5):
        dE = (E - math.degrees(e * math.sin(math.radians(E))) - M) / (1 - e * math.cos(math.radians(E)))
        E -= dE
        if abs(dE) < 1e-6:
            break

    xv = math.cos(math.radians(E)) - e
    yv = math.sqrt(1 - e * e) * math.sin(math.radians(E))
    v  = math.degrees(math.atan2(yv, xv)) % 360

    lon_orb        = math.radians(v + w)
    Nrad, irad     = math.radians(N), math.radians(i)
    xh = math.cos(Nrad) * math.cos(lon_orb) - math.sin(Nrad) * math.sin(lon_orb) * math.cos(irad)
    yh = math.sin(Nrad) * math.cos(lon_orb) + math.cos(Nrad) * math.sin(lon_orb) * math.cos(irad)
    zh = math.sin(lon_orb) * math.sin(irad)

    lon_ecl = math.degrees(math.atan2(yh, xh)) % 360
    lat_ecl = math.degrees(math.atan2(zh, math.sqrt(xh * xh + yh * yh)))

    ecl = math.radians(23.4393 - 3.563e-7 * d)
    x   = math.cos(math.radians(lon_ecl)) * math.cos(math.radians(lat_ecl))
    y   = (math.sin(math.radians(lon_ecl)) * math.cos(math.radians(lat_ecl)) * math.cos(ecl)
           - math.sin(math.radians(lat_ecl)) * math.sin(ecl))
    z   = (math.sin(math.radians(lon_ecl)) * math.cos(math.radians(lat_ecl)) * math.sin(ecl)
           + math.sin(math.radians(lat_ecl)) * math.cos(ecl))

    ra  = math.degrees(math.atan2(y, x)) % 360
    dec = math.degrees(math.asin(max(-1.0, min(1.0, z))))
    return ra, dec


def _moon_altitude(lat, lon, d, ra, dec):
    """Moon's altitude above horizon in degrees."""
    GMST = (280.46061837 + 360.98564736629 * d) % 360
    H    = (GMST + lon - ra) % 360
    sin_alt = (math.sin(math.radians(dec)) * math.sin(math.radians(lat))
               + math.cos(math.radians(dec)) * math.cos(math.radians(lat)) * math.cos(math.radians(H)))
    return math.degrees(math.asin(max(-1.0, min(1.0, sin_alt))))


def moon_rise_set(lat, lon, date_obj):
    """
    Moonrise/moonset found by scanning altitudes every 15 minutes.
    Returns (rise_epoch, set_epoch); either is 0 if not found that day.
    """
    midnight = datetime(date_obj.year, date_obj.month, date_obj.day, tzinfo=timezone.utc)
    horizon  = -0.583  # degrees (standard moonrise refraction correction)
    rise_ep, set_ep = 0, 0
    prev_alt = None

    for i in range(97):  # 0–24 h in 15-min steps
        t        = midnight + timedelta(minutes=15 * i)
        d        = _d2000(t)
        ra, dec  = _moon_equatorial(d)
        alt      = _moon_altitude(lat, lon, d, ra, dec)

        if prev_alt is not None:
            if prev_alt <= horizon < alt and not rise_ep:
                frac    = (horizon - prev_alt) / (alt - prev_alt)
                rise_ep = int(midnight.timestamp() + (i - 1 + frac) * 15 * 60)
            elif prev_alt >= horizon > alt and not set_ep:
                frac   = (prev_alt - horizon) / (prev_alt - alt)
                set_ep = int(midnight.timestamp() + (i - 1 + frac) * 15 * 60)
        prev_alt = alt

    return rise_ep, set_ep


def moon_phase_fraction(date_obj):
    """
    Moon phase: 0.0/1.0 = new moon, 0.25 = first quarter, 0.5 = full moon.
    """
    known_new = datetime(2000, 1, 6, 18, 14, tzinfo=timezone.utc)
    synodic   = 29.530588853
    dt        = datetime(date_obj.year, date_obj.month, date_obj.day, 12, 0, tzinfo=timezone.utc)
    return ((dt - known_new).total_seconds() / 86400.0 % synodic) / synodic


# ── Data loading ──────────────────────────────────────────────────────

def load_json(path):
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return {}


def fetch_daily_periods():
    """Return NWS daily forecast periods, refreshing the in-memory cache as needed."""
    global _daily_cache
    now = time.time()
    if now - _daily_cache["fetchedAt"] < DAILY_CACHE_TTL and _daily_cache["periods"]:
        return _daily_cache["periods"]

    req = urllib.request.Request(NWS_DAILY_URL, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
        periods = data.get("properties", {}).get("periods", [])
        if periods:
            _daily_cache = {"fetchedAt": now, "periods": periods}
            print(f"[api] Refreshed daily forecast ({len(periods)} periods)", flush=True)
        return periods
    except Exception as exc:
        print(f"[api] Daily forecast error: {exc}", flush=True)
        return _daily_cache["periods"]


# ── Response builders ─────────────────────────────────────────────────

def build_current_block(units="metric", sensor=None, nws=None):
    """Build an OWM-style current-conditions object using local sensors + NWS."""
    if sensor is None:
        sensor = load_json(CURRENT_JSON)
    if nws is None:
        nws = load_json(NWS_JSON)

    agg      = sensor.get("aggregate", {})
    c        = nws.get("current", {})
    obs      = nws.get("observations", {})

    temp_c   = agg.get("tempC") or 20.0
    humidity = agg.get("humidity") or 50.0

    wind_mph = parse_wind_mph(c.get("windSpeedMph", 0))
    gust_mph = c.get("windGustMph")
    wind_ms  = wind_mph * 0.44704
    gust_ms  = gust_mph * 0.44704 if gust_mph is not None else None
    wind_dir = wind_dir_deg(c.get("windDirection", ""))

    short    = c.get("shortForecast", "")
    is_day   = c.get("isDaytime", True)
    pressure = int(obs.get("pressureHpa") or 1013)
    vis_km   = obs.get("visibilityKm") or 16.0

    dp_c = dew_point_c(temp_c, humidity)
    fl_c = feels_like_c(temp_c, humidity, wind_ms)

    today = datetime.now(timezone.utc).date()
    sunrise_ep, sunset_ep = sun_rise_set(LOCATION_LAT, LOCATION_LON, today)

    return {
        "dt":         int(time.time()),
        "sunrise":    sunrise_ep,
        "sunset":     sunset_ep,
        "temp":       apply_temp(temp_c, units),
        "feels_like": apply_temp(fl_c,   units),
        "pressure":   pressure,
        "humidity":   int(round(humidity)),
        "dew_point":  apply_temp(dp_c,   units),
        "uvi":        None,  # not available from NWS
        "clouds":     clouds_pct(short),
        "visibility": int(vis_km * 1000),
        "wind_speed": apply_wind(wind_ms, units),
        "wind_deg":   wind_dir,
        "wind_gust":  apply_wind(gust_ms, units) if gust_ms is not None else None,
        "weather":    [sky_to_owm(short, is_day)],
    }


def build_daily_list(units="metric", sensor=None, nws=None):
    """Build a 7-entry OWM-style daily forecast list from NWS daily periods."""
    periods  = fetch_daily_periods()
    if nws is None:
        nws = load_json(NWS_JSON)
    if sensor is None:
        sensor = load_json(CURRENT_JSON)
    pressure = int((nws.get("observations") or {}).get("pressureHpa") or 1013)
    today_str = datetime.now(PACIFIC).strftime("%Y-%m-%d")
    agg = sensor.get("aggregate") or {}
    sensor_temp_c   = agg.get("tempC")
    sensor_humidity = agg.get("humidity")
    today_high_c    = agg.get("todayHighC")  # maintained by data_writer.py

    # Group day/night periods by calendar date
    by_date = defaultdict(dict)
    for p in periods:
        date_str = p.get("startTime", "")[:10]
        key      = "day" if p.get("isDaytime", True) else "night"
        by_date[date_str][key] = p

    daily = []
    for date_str in sorted(by_date.keys())[:7]:
        d       = by_date[date_str]
        day_p   = d.get("day")
        night_p = d.get("night")
        anchor  = day_p or night_p

        # Temperatures — NWS returns °F
        day_c   = f_to_c(day_p["temperature"])   if day_p   else None
        night_c = f_to_c(night_p["temperature"]) if night_p else None
        temps   = [t for t in (day_c, night_c) if t is not None]
        # For today, use today's observed SQLite max so the high reflects the
        # actual peak, not just the current reading.
        if date_str == today_str:
            if today_high_c is not None:
                temps.append(today_high_c)
            elif sensor_temp_c is not None:
                temps.append(sensor_temp_c)
        max_c   = max(temps) if temps else 20.0
        min_c   = min(temps) if temps else 10.0

        wind_ms  = parse_wind_mph(anchor.get("windSpeed", "")) * 0.44704
        wind_dir = wind_dir_deg(anchor.get("windDirection", ""))

        day_pop   = ((day_p.get("probabilityOfPrecipitation") or {}).get("value") or 0) if day_p   else 0
        night_pop = ((night_p.get("probabilityOfPrecipitation") or {}).get("value") or 0) if night_p else 0
        pop = max(day_pop, night_pop) / 100.0

        short = anchor.get("shortForecast", "")

        # Timestamp: noon on that calendar day (offset-aware → UTC epoch)
        try:
            start_iso = anchor.get("startTime")
            if start_iso:
                dt_start = datetime.fromisoformat(start_iso)
            else:
                dt_start = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=PACIFIC)
            dt_noon = dt_start.replace(hour=12, minute=0, second=0, microsecond=0)
            dt_ts   = int(dt_noon.timestamp())
        except Exception:
            dt_ts = int(time.time())

        try:
            cal_date = datetime.fromisoformat(date_str).date()
        except Exception:
            cal_date = datetime.now(timezone.utc).date()

        sunrise_ep, sunset_ep     = sun_rise_set(LOCATION_LAT, LOCATION_LON, cal_date)
        moonrise_ep, moonset_ep   = moon_rise_set(LOCATION_LAT, LOCATION_LON, cal_date)
        phase                     = moon_phase_fraction(cal_date)

        day_short   = day_p.get("shortForecast", "")   if day_p   else short
        night_short = night_p.get("shortForecast", "") if night_p else short

        day_wind_ms   = parse_wind_mph(day_p.get("windSpeed", ""))   * 0.44704 if day_p   else wind_ms
        night_wind_ms = parse_wind_mph(night_p.get("windSpeed", "")) * 0.44704 if night_p else wind_ms

        daily.append({
            "dt":         dt_ts,
            "sunrise":    sunrise_ep,
            "sunset":     sunset_ep,
            "moonrise":   moonrise_ep,
            "moonset":    moonset_ep,
            "moon_phase": round(phase, 2),
            "summary":    short,
            "temp": {
                "day":   apply_temp(day_c or max_c,   units),
                "min":   apply_temp(min_c,             units),
                "max":   apply_temp(max_c,             units),
                "night": apply_temp(night_c or min_c,  units),
                "eve":   apply_temp(max_c,             units),
                "morn":  apply_temp(min_c,             units),
            },
            "pressure":   pressure,
            "humidity":   int(round(sensor_humidity)) if date_str == today_str and sensor_humidity is not None else None,
            "dew_point":  apply_temp(dew_point_c(max_c, sensor_humidity), units) if date_str == today_str and sensor_humidity is not None else None,
            "wind_speed": apply_wind(wind_ms, units),
            "wind_deg":   wind_dir,
            "wind_gust":  None,
            "weather":    [sky_to_owm(short, True)],
            "clouds":     clouds_pct(short),
            "pop":        pop,
            "uvi":        None,  # not available from NWS
            "day_detail": {
                "weather":    [sky_to_owm(day_short, True)],
                "pop":        day_pop / 100.0,
                "wind_speed": apply_wind(day_wind_ms, units),
                "summary":    day_short,
            },
            "night_detail": {
                "weather":    [sky_to_owm(night_short, False)],
                "pop":        night_pop / 100.0,
                "wind_speed": apply_wind(night_wind_ms, units),
                "summary":    night_short,
            },
        })

    return daily


# ── HTTP handler ──────────────────────────────────────────────────────

class WeatherHandler(BaseHTTPRequestHandler):

    def log_message(self, fmt, *args):
        pass  # Silence default per-request logging

    def send_json(self, data, status=200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type",   "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control",  "no-cache")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        units  = params.get("units", ["metric"])[0].lower()
        if units not in ("metric", "imperial", "standard"):
            units = "metric"
        path = parsed.path.rstrip("/")

        # Load data files once per request
        sensor = load_json(CURRENT_JSON)
        nws    = load_json(NWS_JSON)
        tz_offset = int(datetime.now(PACIFIC).utcoffset().total_seconds())

        if path in ("/data/3.0/onecall", "/data/2.5/onecall"):
            self.send_json({
                "lat":             LOCATION_LAT,
                "lon":             LOCATION_LON,
                "name":            LOCATION_NAME,
                "timezone":        "America/Los_Angeles",
                "timezone_offset": tz_offset,
                "current":         build_current_block(units, sensor, nws),
                "daily":           build_daily_list(units, sensor, nws),
            })

        elif path == "/data/2.5/weather":
            cur = build_current_block(units, sensor, nws)
            self.send_json({
                "coord":      {"lon": LOCATION_LON, "lat": LOCATION_LAT},
                "weather":    cur["weather"],
                "main": {
                    "temp":       cur["temp"],
                    "feels_like": cur["feels_like"],
                    "pressure":   cur["pressure"],
                    "humidity":   cur["humidity"],
                },
                "visibility": cur["visibility"],
                "wind":       {"speed": cur["wind_speed"], "deg": cur["wind_deg"]},
                "clouds":     {"all": cur["clouds"]},
                "dt":         cur["dt"],
                "timezone":   tz_offset,
                "name":       "Hollister",
                "cod":        200,
            })

        elif path == "/api/v1/current":
            self.send_json({
                "current":      build_current_block("metric", sensor, nws),
                "channels":     sensor.get("channels"),
                "nws":          nws.get("current"),
                "observations": nws.get("observations"),
                "generatedAt":  sensor.get("generatedAt"),
            })

        elif path == "/api/v1/forecast":
            self.send_json({"daily": build_daily_list(units, sensor, nws)})

        else:
            self.send_json({"error": "Not found"}, 404)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", API_PORT), WeatherHandler)
    print(f"[api] Weather API listening on :{API_PORT}", flush=True)
    server.serve_forever()
