# weather-station

A personal weather dashboard that reads 433 MHz temperature/humidity sensors and displays live conditions with a poetic prose narrative. Runs entirely in Docker on a home server.

---

## What it does

- Decodes radio transmissions from Oregon Scientific THGR810 sensors via an RTL-SDR USB dongle
- Stores readings in SQLite and pre-computes a JSON snapshot every 20 seconds
- Displays live temperature and humidity with a color-coded status indicator (green/yellow/red based on battery and signal age)
- Fetches supplementary weather data from the NWS public API (wind speed/direction, sky conditions, precipitation probability) every 20 minutes
- Generates a short poetic paragraph describing what it feels like to be outside right now — updated whenever conditions change meaningfully
- Serves a single-page dashboard over HTTP on port 8001 with no dependencies or build step

---

## Hardware

| Component | Notes |
|---|---|
| RTL-SDR USB dongle | Any RTL2832U-based receiver works |
| Oregon Scientific THGR810 | 433 MHz temperature/humidity sensor, reports every ~47s |

Any sensor model supported by `rtl_433` can be added to `SENSOR_MODELS` in `config.py`.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Docker container (weather-station:local)                 │
│                                                          │
│  rtl_433 ──────────► temperature_data.csv               │
│                              │                           │
│  data_writer.py ◄────────────┘                          │
│       │                                                  │
│       ├──► weather.db  (SQLite, WAL mode)               │
│       └──► current.json  (regenerated every 20s)        │
│                                                          │
│  fetch_nws.py ──────► nws_forecast.json                 │
│                                                          │
│  python3 -m http.server ──► :8000                       │
└──────────────────────────┬───────────────────────────────┘
                           │ port 8001
                    ┌──────▼──────┐
                    │   Browser   │
                    │  index.html │
                    │  app.js     │
                    │  weather-   │
                    │ narrative.js│
                    └─────────────┘
```

### Data flow

1. `rtl_433` listens on the USB dongle and appends decoded sensor readings to `app/temperature_data.csv`.
2. `data_writer.py` polls the CSV every 10 seconds, imports new rows into SQLite (`weather.db`), and regenerates `app/current.json` every 20 seconds. It detects file replacement (daily rotation) via inode comparison.
3. `fetch_nws.py` polls `api.weather.gov` every 20 minutes and atomically writes `app/nws_forecast.json`.
4. `python3 -m http.server` serves the `app/` directory as static files.
5. The browser fetches `current.json` every 10 seconds and `nws_forecast.json` every 5 minutes, then generates and displays the narrative.

### CSV rotation

At Pacific midnight, `entrypoint.sh` moves `temperature_data.csv` to a dated archive (`temperature_data_YYYY-MM-DD.csv`), restarts `rtl_433` so it opens a fresh file, and deletes archives older than 7 days. `data_writer.py` detects the new inode and resets its offset automatically.

### Supervisor

`entrypoint.sh` forks all processes and watches their PIDs in a 2-second loop:

| Process | On exit |
|---|---|
| `rtl_433` | Restarted automatically |
| `data_writer.py` | Restarted automatically |
| `fetch_nws.py` | Restarted automatically |
| `python3 -m http.server` | Fatal — container stops |

---

## NWS integration

The NWS public API (`api.weather.gov`) is free, requires no API key, and asks only for a descriptive `User-Agent` header. `fetch_nws.py` fetches the hourly forecast for NOAA grid point **MTR/113,56** (Monterey Bay forecast office).

**Output** — `app/nws_forecast.json`:
```json
{
  "fetchedAt": 1709056800.0,
  "current": {
    "windSpeedMph": 3,
    "windDirection": "SSE",
    "probabilityOfPrecipitation": 2,
    "shortForecast": "Mostly Cloudy",
    "isDaytime": false
  }
}
```

If the fetch fails for any reason, the existing file is left unchanged. If the file is absent or older than 90 minutes, the narrative engine degrades gracefully and generates text from sensor data only.

To use a different location, find your NWS grid point:
```
https://api.weather.gov/points/{lat},{lon}
```
Then update `NWS_URL` in `config.py` with the `forecastHourly` URL from the response.

---

## Narrative engine

`app/weather-narrative.js` generates a short poetic paragraph on each render cycle. It is designed to answer: *what does it feel like to be outside right now?*

### Inputs

| Source | Fields |
|---|---|
| Local sensors (authoritative) | temperature (°C), humidity (%) |
| NWS API (supplementary) | wind speed/direction, sky condition, precipitation probability |
| System clock | time of day, date, season |

Temperature and humidity always come from the physical sensors — they are hyper-local and measured directly. The NWS data is regional but provides context the sensors cannot: whether it is raining, how windy it is, what the sky looks like.

### How it works

The engine derives a context object from all inputs:

- **tempBand** — freezing / cold / cool / mild / warm / hot / scorching
- **humidityBand** — arid / dry / comfortable / humid / oppressive
- **windBand** — calm / light / moderate / breezy / windy
- **timeBand** — pre-dawn / morning / midday / afternoon / evening / night / late-night
- **season** — winter / spring / summer / autumn
- **skyCondition** — clear / partly-cloudy / mostly-cloudy / overcast / fog / rain / heavy-rain / snow / thunderstorm

It then selects one of nine **arc templates** based on the dominant weather story:

| Template | Triggers |
|---|---|
| `snowScene` | sky is snow |
| `fogScene` | sky is fog |
| `rainLead` | sky is rain/heavy-rain/thunderstorm, or precip ≥ 50% |
| `windLead` | wind is breezy or windy |
| `clearNight` | night + clear sky + notable moon phase |
| `extremeCold` | temp band is freezing |
| `extremeHeat` | temp band is hot or scorching |
| `pleasantWalk` | mild/cool + calm/light wind + no precip |
| `seasonalMoment` | default fallback |

Each template assembles 2–4 sentences from vocabulary pools that share a subject and develop a single coherent scene.

### Anti-repetition and stability

- **Seeded RNG** (mulberry32 + FNV hash): each generation is seeded from `tempC + humidity + date + counter`, so output is reproducible per-conditions but varies across calls.
- **Recent phrase tracking**: the last 12 phrases picked per pool per day are excluded from selection.
- **Hysteresis**: band boundaries have a dead zone (±0.3 °C, ±2% humidity) to prevent chatty regeneration from sensor noise.
- **Hold timer**: narrative holds for at least 5 minutes after generation, up to 30 minutes if nothing significant changes.
- **State persistence**: narrative state is saved to `localStorage` and restored on reload.

Regeneration is triggered by: temperature or humidity crossing a band boundary, wind band changing, sky condition changing, or precipitation probability crossing the 40% threshold.

---

## Files

```
weather-station/
├── Dockerfile                  Alpine Linux + rtl_433 + Python
├── docker-compose.yaml         Volume mounts, port, USB passthrough
├── entrypoint.sh               Process supervisor + daily CSV rotation
├── config.py                   Shared config for all Python scripts
├── data_writer.py              CSV watcher → SQLite → current.json
├── fetch_nws.py                NWS forecast poller (stdlib only, every 20min)
├── migrate.py                  One-time historical CSV → SQLite import
└── app/
    ├── index.html              Page markup
    ├── styles.css              All styles, responsive breakpoints
    ├── app.js                  Dashboard logic (reads current.json + nws_forecast.json)
    ├── config.js               Browser-side tunable parameters
    └── weather-narrative.js    Poetic narrative engine

Runtime files (not in git):
    weather.db                  SQLite database (outside app/, not web-served)
    csv_watcher_state.json      CSV read offset/inode state (outside app/)
    app/temperature_data.csv    Raw rtl_433 output (rotated nightly)
    app/current.json            Pre-computed sensor snapshot (20s TTL)
    app/nws_forecast.json       Cached NWS forecast (20min TTL)
```

---

## Configuration

`config.py` is the single source of truth for all Python-side configuration:

```python
SENSOR_MODELS  = {"Oregon-THGR810"}          # set of accepted rtl_433 model strings
VALID_CHANNELS = {0, 1, 2}
CHANNEL_NAMES  = {0: "Back Porch", 1: "Front Porch", 2: "Side House"}

CSV_PATH     = "/weather-station/app/temperature_data.csv"
DB_PATH      = "/weather-station/weather.db"
NWS_URL      = "https://api.weather.gov/gridpoints/MTR/113,56/forecast/hourly"
```

All paths are overridable via environment variables (`WEATHER_CSV`, `WEATHER_DB`, `WEATHER_CURRENT`, `WEATHER_NWS`, `WEATHER_STATE`).

Browser-side settings live in `app/config.js` (fetch intervals, narrative thresholds, NWS stale timeout).

---

## Run

```sh
docker compose up --build -d
```

The dashboard is available at `http://<host>:8001`.

**Requirements:**
- Docker with compose
- RTL-SDR USB dongle passed through via `/dev/bus/usb`
- A compatible 433 MHz temperature sensor in range

**First run:** `rtl_433` begins writing to `temperature_data.csv` immediately. The NWS forecast is fetched within the first few seconds. The dashboard will show live data within one sensor transmission cycle (~47 seconds for THGR810).

**Importing historical data:** If you have an existing `temperature_data.csv`, import it into the database before starting the container:

```sh
python3 migrate.py --csv /path/to/temperature_data.csv --db /path/to/weather.db
```

The import is idempotent — safe to run multiple times.

---

## Logs

```sh
docker compose logs -f
```

Key log prefixes:
- `[data_writer]` — CSV import and current.json generation
- `[nws]` — NWS fetch results and errors
- `[rotate]` — daily CSV rotation events
- `[watchdog]` — process restarts
- `rtl_433` output — decoded sensor packets

---

## Graceful degradation

| Failure | Behaviour |
|---|---|
| `fetch_nws.py` exits | Automatically restarted by `entrypoint.sh` |
| NWS network error | Existing `nws_forecast.json` kept; browser uses last good value |
| `nws_forecast.json` absent or stale (>90min) | Narrative generates from sensor data only |
| `rtl_433` exits | Automatically restarted by `entrypoint.sh` |
| `data_writer.py` exits | Automatically restarted; picks up from saved CSV offset |
| Sensor out of range / battery low | UI shows stale indicator; last known values displayed |
