# weather-station

A personal weather dashboard that reads 433 MHz temperature/humidity sensors and displays live conditions with a poetic prose narrative. Runs entirely in Docker on a home server.

---

## What it does

- Decodes radio transmissions from Oregon Scientific THGR810 sensors via an RTL-SDR USB dongle
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

Any sensor supported by `rtl_433` should work; the CSV parsing in `tail_csv.sh` is generic.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Docker container (weather-station:local)            │
│                                                      │
│  rtl_433 ──────────► temperature_data.csv           │
│                              │                       │
│  tail_csv.sh ◄───────────────┘                      │
│       │                                              │
│       └──► temperature_data_live.csv (last 50 rows) │
│                                                      │
│  fetch_nws.py ──────► nws_forecast.json             │
│                                                      │
│  python3 -m http.server ──► :8000                   │
└──────────────────────────┬──────────────────────────┘
                           │ port 8001
                    ┌──────▼──────┐
                    │   Browser   │
                    │  index.html │
                    │  config.js  │
                    │  weather-   │
                    │ narrative.js│
                    └─────────────┘
```

### Data flow

1. `rtl_433` listens on the USB dongle and appends decoded sensor readings to `temperature_data.csv` in CSV format.
2. `tail_csv.sh` wakes every 20 seconds, atomically publishes the last 50 rows as `temperature_data_live.csv` (safe for concurrent HTTP reads).
3. `fetch_nws.py` polls `api.weather.gov` every 20 minutes for the current hourly forecast and atomically writes `nws_forecast.json`.
4. `python3 -m http.server` serves the `app/` directory as static files.
5. The browser fetches `temperature_data_live.csv` every 10 seconds and `nws_forecast.json` every 5 minutes, then generates and displays the narrative.

### Supervisor

`entrypoint.sh` forks all four processes and watches their PIDs in a 2-second loop:

- `rtl_433` — fatal if it exits; container stops
- `tail_csv.sh` — fatal if it exits; container stops
- `python3 -m http.server` — fatal if it exits; container stops
- `fetch_nws.py` — non-fatal; automatically restarted if it exits (network hiccup, etc.)

---

## NWS integration

The NWS public API (`api.weather.gov`) is free, requires no API key, and asks only for a descriptive `User-Agent` header. `fetch_nws.py` fetches the hourly forecast for NOAA grid point **MTR/113,56** (Monterey Bay forecast office, covering this location).

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

If the fetch fails for any reason (network error, HTTP error, malformed response), the existing file is left unchanged and the dashboard continues using the last good value. If the file is absent or older than 90 minutes, the narrative engine degrades gracefully and generates text from sensor data only.

To use a different location, find your NWS grid point:
```
https://api.weather.gov/points/{lat},{lon}
```
Then update `NWS_URL` in `fetch_nws.py` with the `forecastHourly` URL from the response.

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

Each template is a function that assembles 2–4 sentences from vocabulary pools. Sentences within a template build on each other — they share a subject and develop a single coherent scene rather than being independent fragments.

### Anti-repetition and stability

- **Seeded RNG** (mulberry32 + FNV hash): each generation is seeded from `tempC + humidity + date + counter`, so output is reproducible per-conditions but varies across calls.
- **Recent phrase tracking**: the last 12 phrases picked per pool per day are excluded from selection, preventing repetition across regen cycles.
- **Hysteresis**: band boundaries have a dead zone (±0.3 °C, ±2% humidity) to prevent chatty narrative regeneration from sensor noise.
- **Hold timer**: narrative holds for at least 5 minutes after generation, up to 30 minutes if nothing significant changes.
- **State persistence**: `narrativeState` is saved to `localStorage` and restored on reload, so the poem does not reset on page refresh.

Regeneration is triggered by:
- Temperature crossing a band boundary
- Humidity crossing a band boundary
- Wind band changing (from NWS)
- Sky condition changing (from NWS)
- Precipitation probability crossing the 40% threshold

---

## Files

```
weather-station/
├── Dockerfile              Alpine Linux + rtl_433 + Python
├── docker-compose.yaml     Volume mounts, port, USB passthrough, timezone
├── entrypoint.sh           Process supervisor (forks 4 daemons)
├── tail_csv.sh             Atomically publishes last 50 CSV rows every 20s
├── fetch_nws.py            NWS forecast poller (stdlib only, every 20min)
└── app/
    ├── index.html          Single-page dashboard (~1400 lines, all inline JS)
    ├── config.js           Tunable parameters (intervals, thresholds, timezone)
    ├── weather-narrative.js  Poetic narrative engine (arc templates + vocabulary)
    ├── temperature_data.csv        Raw rtl_433 output (append-only)
    └── temperature_data_live.csv   Atomic snapshot served to browser
```

---

## Configuration

Edit `app/config.js` to change behaviour without rebuilding:

```js
global.WEATHER_CONFIG = {
  data: {
    updateIntervalMs: 10000,          // how often browser re-reads CSV
    timestampZone: "America/Los_Angeles",
    timezoneLabel: "PST",
  },
  narrative: {
    minHoldMs: 5 * 60 * 1000,        // minimum time between narrative updates
    maxHoldMs: 30 * 60 * 1000,       // maximum time before forced refresh
    tempDeltaC: 0.8,                  // temp change needed to trigger regen
    humidityDeltaPct: 5,              // humidity change needed to trigger regen
    tempBandHysteresisC: 0.3,        // dead zone at band boundaries
    humidityBandHysteresisPct: 2,
  },
  nws: {
    fetchIntervalMs: 5 * 60 * 1000,  // how often browser re-reads nws_forecast.json
    dataFile: "nws_forecast.json",
    staleAfterMs: 90 * 60 * 1000,   // treat NWS data as stale after 90 minutes
  },
};
```

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

---

## Logs

```sh
docker compose logs -f
```

Key log prefixes:
- `[nws]` — NWS fetch results and errors
- `rtl_433` output — decoded sensor packets
- HTTP server access log — browser requests

---

## Graceful degradation

| Failure | Behaviour |
|---|---|
| `fetch_nws.py` exits | Automatically restarted by `entrypoint.sh` |
| NWS network error | Existing `nws_forecast.json` kept; browser uses last good value |
| `nws_forecast.json` absent or stale (>90min) | Narrative generates from sensor data only |
| `rtl_433` exits | Container stops (sensor data is the core function) |
| Sensor out of range / battery low | UI shows stale indicator; last known values displayed |
