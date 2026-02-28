// ── Configuration ──────────────────────────────────────────────────
const VALID_CHANNELS = [0, 1, 2];

const APP_CONFIG       = typeof WEATHER_CONFIG !== "undefined" ? WEATHER_CONFIG : {};
const DATA_CONFIG      = APP_CONFIG.data      || {};
const NARRATIVE_CONFIG = APP_CONFIG.narrative || {};
const NWS_CONFIG_OBJ   = APP_CONFIG.nws       || {};

const UPDATE_INTERVAL          = DATA_CONFIG.updateIntervalMs              || 10000;
const TIMESTAMP_ZONE           = DATA_CONFIG.timestampZone                 || "America/Los_Angeles";
const TIMEZONE_LABEL           = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMESTAMP_ZONE, timeZoneName: "short",
}).formatToParts(new Date()).find(p => p.type === "timeZoneName")?.value ?? "PST";
const NARRATIVE_MIN_HOLD_MS    = NARRATIVE_CONFIG.minHoldMs                || 5  * 60 * 1000;
const NARRATIVE_MAX_HOLD_MS    = NARRATIVE_CONFIG.maxHoldMs                || 30 * 60 * 1000;
const NARRATIVE_TEMP_DELTA_C   = NARRATIVE_CONFIG.tempDeltaC               || 0.8;
const NARRATIVE_HUMIDITY_DELTA = NARRATIVE_CONFIG.humidityDeltaPct         || 5;
const NARRATIVE_TEMP_HYS_C     = NARRATIVE_CONFIG.tempBandHysteresisC      || 0.3;
const NARRATIVE_HUM_HYS_PCT    = NARRATIVE_CONFIG.humidityBandHysteresisPct || 2;
const NWS_FETCH_INTERVAL_MS    = NWS_CONFIG_OBJ.fetchIntervalMs            || 5  * 60 * 1000;
const NWS_DATA_FILE            = NWS_CONFIG_OBJ.dataFile                   || "nws_forecast.json";
const NWS_STALE_AFTER_MS       = NWS_CONFIG_OBJ.staleAfterMs               || 90 * 60 * 1000;
const NARRATIVE_STORAGE_KEY    = "weatherStationNarrativeStateV2";

// ── State ──────────────────────────────────────────────────────────
let currentTempC    = null;
let avgHumidity     = null;
let currentChannels = null;   // per-channel data from current.json
let nwsData         = null;

let narrativeState = {
    text: null, generatedAtMs: 0,
    tempC: null, humidity: null,
    tempBand: null, humidityBand: null, timeBand: null,
    freshness: null, windBand: null, skyCondition: null, precipProb: null,
};

// ── DOM references ─────────────────────────────────────────────────
const tempValue        = document.getElementById("temperature-value");
const tempUnit         = document.getElementById("temperature-unit");
const humidityValue    = document.getElementById("humidity-value");
const updateTime       = document.getElementById("update-time");
const weatherPhrase    = document.getElementById("weather-phrase");
const timezoneLabel    = document.getElementById("timezone-label");
const celsiusBtn       = document.getElementById("celsius-btn");
const fahrenheitBtn    = document.getElementById("fahrenheit-btn");
const loadingIndicator = document.getElementById("loading-indicator");

timezoneLabel.textContent = TIMEZONE_LABEL;

// ── Narrative state persistence ────────────────────────────────────
function getNarrativeDayKey(date) {
    const d = date || new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function saveNarrativeStateToStorage() {
    try {
        localStorage.setItem(NARRATIVE_STORAGE_KEY, JSON.stringify({
            dayKey: getNarrativeDayKey(new Date()),
            narrativeState,
        }));
    } catch (err) {
        console.warn("Unable to persist narrative state:", err);
    }
}

function loadNarrativeStateFromStorage() {
    try {
        const raw = localStorage.getItem(NARRATIVE_STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!parsed?.narrativeState || parsed.dayKey !== getNarrativeDayKey(new Date())) {
            localStorage.removeItem(NARRATIVE_STORAGE_KEY);
            return;
        }
        const stored = parsed.narrativeState;
        if (!stored || typeof stored.text !== "string") return;
        narrativeState = {
            text:          stored.text          || null,
            generatedAtMs: Number(stored.generatedAtMs) || 0,
            tempC:         typeof stored.tempC     === "number" ? stored.tempC     : null,
            humidity:      typeof stored.humidity  === "number" ? stored.humidity  : null,
            tempBand:      stored.tempBand      || null,
            humidityBand:  stored.humidityBand  || null,
            timeBand:      stored.timeBand      || null,
            freshness:     stored.freshness     || null,
            windBand:      stored.windBand      || null,
            skyCondition:  stored.skyCondition  || null,
            precipProb:    typeof stored.precipProb === "number" ? stored.precipProb : null,
        };
        if (narrativeState.text) weatherPhrase.textContent = narrativeState.text;
    } catch (err) {
        console.warn("Unable to restore narrative state:", err);
    }
}

// ── Zone helpers ───────────────────────────────────────────────────
function getCurrentHourInTimestampZone() {
    return Number(new Intl.DateTimeFormat("en-US", {
        timeZone: TIMESTAMP_ZONE, hour: "2-digit", hour12: false,
    }).format(new Date()));
}

function getTimeBand(hours) {
    if (hours <  5) return "late-night";
    if (hours <  8) return "dawn";
    if (hours < 12) return "morning";
    if (hours < 17) return "afternoon";
    if (hours < 21) return "evening";
    return "night";
}

// ── Unit conversion ────────────────────────────────────────────────
function isCelsius() { return celsiusBtn.classList.contains("active"); }

function convertTemp(tempC) {
    return isCelsius() ? tempC.toFixed(1) : Math.round((tempC * 9) / 5 + 32);
}

function tempUnitStr() { return isCelsius() ? "°C" : "°F"; }

// ── Temperature bands ──────────────────────────────────────────────
function applyBandHysteresis(value, previousBand, bands, margin) {
    if (!previousBand) return bands.find(b => value <= b.max).name;
    const previous = bands.find(b => b.name === previousBand);
    if (!previous) return bands.find(b => value <= b.max).name;
    const low  = previous.min === -Infinity ? -Infinity : previous.min - margin;
    const high = previous.max ===  Infinity ?  Infinity : previous.max + margin;
    if (value >= low && value <= high) return previousBand;
    return bands.find(b => value <= b.max).name;
}

function getStableTemperatureBand(tempC, previousBand) {
    const bands = [
        { name: "freezing",  min: -Infinity, max: 0  },
        { name: "cold",      min: 0,          max: 7  },
        { name: "cool",      min: 7,          max: 14 },
        { name: "mild",      min: 14,         max: 22 },
        { name: "warm",      min: 22,         max: 28 },
        { name: "hot",       min: 28,         max: 33 },
        { name: "scorching", min: 33,         max: Infinity },
    ];
    return applyBandHysteresis(tempC, previousBand, bands, NARRATIVE_TEMP_HYS_C);
}

function getStableHumidityBand(humidity, previousBand) {
    const bands = [
        { name: "dry",         min: -Infinity, max: 30 },
        { name: "comfortable", min: 30,         max: 45 },
        { name: "balanced",    min: 45,         max: 65 },
        { name: "humid",       min: 65,         max: 80 },
        { name: "saturated",   min: 80,         max: Infinity },
    ];
    return applyBandHysteresis(humidity, previousBand, bands, NARRATIVE_HUM_HYS_PCT);
}

function getFreshnessState() {
    if (!currentChannels) return "stale";
    return Object.values(currentChannels).some(ch => ch.online) ? "fresh" : "stale";
}

// ── Trend arrow ────────────────────────────────────────────────────
function updateTrendArrow(rate) {
    const trendEl = document.getElementById("temp-trend");
    if (!trendEl) return;
    rate = rate ?? 0;
    const clamped = Math.max(-0.4, Math.min(0.4, rate));
    const angle   = -(clamped / 0.4) * 90;

    trendEl.querySelector("i").style.transform = `rotate(${angle}deg)`;

    if (Math.abs(clamped) < 0.05) {
        trendEl.style.color = "rgba(255,255,255,0.32)";
    } else if (clamped > 0) {
        trendEl.style.color = "rgba(255, 160, 60, 0.85)";
    } else {
        trendEl.style.color = "rgba(100, 190, 255, 0.85)";
    }
}

// ── Feels like ────────────────────────────────────────────────────
function computeFeelsLike(tempC, humidity, windSpeedMph) {
    if (tempC === null) return null;
    const windKph = (windSpeedMph || 0) * 1.60934;
    // Wind chill: < 10°C and wind > 4.8 km/h
    if (tempC < 10 && windKph > 4.8) {
        const v = Math.pow(windKph, 0.16);
        return 13.12 + 0.6215 * tempC - 11.37 * v + 0.3965 * tempC * v;
    }
    // Heat index: > 27°C and humidity > 40%
    if (tempC > 27 && (humidity || 0) > 40) {
        const T = tempC, H = humidity;
        return -8.78469475556 + 1.61139411*T + 2.3385248*H
             - 0.14611605*T*H - 0.012308094*T*T
             - 0.016424828*H*H + 0.002211732*T*T*H
             + 0.00072546*T*H*H - 0.000003582*T*T*H*H;
    }
    return tempC;
}

function updateFeelsLike() {
    const el = document.getElementById("feels-like-value");
    if (!el) return;
    const windMph = nwsData ? nwsData.windSpeedMph : 0;
    const feelsC  = computeFeelsLike(currentTempC, avgHumidity, windMph);
    if (feelsC === null) { el.textContent = "--"; return; }
    el.textContent = isCelsius()
        ? `${feelsC.toFixed(1)}°C`
        : `${Math.round((feelsC * 9/5) + 32)}°F`;
}

// ── Weather icon & condition strip ─────────────────────────────────
const ICON_MAP = {
    "clear":         { day: ["fa-sun",         "icon-sun"],   night: ["fa-moon",       "icon-moon"]  },
    "partly-cloudy": { day: ["fa-cloud-sun",   "icon-sun"],   night: ["fa-cloud-moon", "icon-moon"]  },
    "mostly-cloudy": { day: ["fa-cloud",       "icon-cloud"], night: ["fa-cloud",      "icon-cloud"] },
    "overcast":      { day: ["fa-cloud",       "icon-cloud"], night: ["fa-cloud",      "icon-cloud"] },
    "fog":           { day: ["fa-smog",        "icon-fog"],   night: ["fa-smog",       "icon-fog"]   },
    "rain":          { day: ["fa-cloud-rain",  "icon-rain"],  night: ["fa-cloud-rain", "icon-rain"]  },
    "heavy-rain":    { day: ["fa-cloud-showers-heavy","icon-rain"], night: ["fa-cloud-showers-heavy","icon-rain"] },
    "snow":          { day: ["fa-snowflake",   "icon-snow"],  night: ["fa-snowflake",  "icon-snow"]  },
    "thunderstorm":  { day: ["fa-cloud-bolt",  "icon-storm"], night: ["fa-cloud-bolt", "icon-storm"] },
};

function updateWeatherIcon() {
    const iconEl        = document.getElementById("weather-icon");
    const condLabel     = document.getElementById("condition-label");
    const windDisplay   = document.getElementById("wind-display");
    const precipDisplay = document.getElementById("precip-display");
    if (!iconEl) return;

    const hour    = getCurrentHourInTimestampZone();
    const isDay   = nwsData ? nwsData.isDaytime !== false : (hour >= 7 && hour < 20);
    const sky     = nwsData?.skyCondition;
    const entry   = ICON_MAP[sky];
    const variant = isDay ? "day" : "night";
    const [iconClass, colorClass] = entry
        ? entry[variant]
        : (isDay ? ["fa-sun","icon-sun"] : ["fa-moon","icon-moon"]);

    iconEl.innerHTML = `<i class="fas ${iconClass} ${colorClass}"></i>`;

    condLabel.textContent = nwsData?.shortForecast || "--";

    if (nwsData) {
        const mph = Math.round(nwsData.windSpeedMph || 0);
        const dir = nwsData.windDirection || "";
        windDisplay.innerHTML = mph > 0
            ? `<i class="fas fa-wind"></i> ${mph} mph ${dir}`
            : `<i class="fas fa-wind"></i> Calm`;

        const precip = nwsData.precipProb ?? 0;
        precipDisplay.innerHTML = `<i class="fas fa-droplet"></i> ${precip}%`;
    } else {
        windDisplay.innerHTML   = `<i class="fas fa-wind"></i> --`;
        precipDisplay.innerHTML = `<i class="fas fa-droplet"></i> --%`;
    }
}

// ── Narrative ──────────────────────────────────────────────────────
function getWeatherPhrase(tempC, humidity) {
    if (typeof WeatherNarrative !== "undefined" && WeatherNarrative?.generate) {
        return WeatherNarrative.generate(tempC, humidity, new Date(), {
            timeZone: TIMESTAMP_ZONE,
            wind: nwsData
                ? { speedMph: nwsData.windSpeedMph, direction: nwsData.windDirection, band: nwsData.windBand }
                : null,
            skyCondition: nwsData?.skyCondition ?? null,
            precipProb:   nwsData?.precipProb   ?? null,
        });
    }
    return "Waiting for enough sensor data to describe conditions.";
}

function shouldRegenerateNarrative(current, previous, nowMs) {
    if (!previous.text) return true;
    if (current.freshness === "fresh" && previous.freshness === "stale") return true;
    const ageMs = nowMs - previous.generatedAtMs;
    if (ageMs >= NARRATIVE_MAX_HOLD_MS) return true;
    if (ageMs <  NARRATIVE_MIN_HOLD_MS) return false;
    if (Math.abs(current.tempC    - previous.tempC)    >= NARRATIVE_TEMP_DELTA_C)   return true;
    if (Math.abs(current.humidity - previous.humidity) >= NARRATIVE_HUMIDITY_DELTA) return true;
    if (current.tempBand     !== previous.tempBand)     return true;
    if (current.humidityBand !== previous.humidityBand) return true;
    if (current.timeBand     !== previous.timeBand)     return true;
    if (current.freshness    !== previous.freshness)    return true;
    if (current.windBand     !== previous.windBand)     return true;
    if (current.skyCondition !== previous.skyCondition) return true;
    const prevRaining = (previous.precipProb ?? 0) >= 40;
    const currRaining = (current.precipProb  ?? 0) >= 40;
    if (prevRaining !== currRaining) return true;
    return false;
}

function updateWeatherNarrative(tempC, humidity) {
    if (tempC === null || humidity === null) {
        weatherPhrase.textContent = "Waiting for enough sensor data to describe conditions.";
        return;
    }
    const nowMs   = Date.now();
    const current = {
        tempC,
        humidity,
        tempBand:     getStableTemperatureBand(tempC,    narrativeState.tempBand),
        humidityBand: getStableHumidityBand(humidity,    narrativeState.humidityBand),
        timeBand:     getTimeBand(getCurrentHourInTimestampZone()),
        freshness:    getFreshnessState(),
        windBand:     nwsData?.windBand     ?? null,
        skyCondition: nwsData?.skyCondition ?? null,
        precipProb:   nwsData?.precipProb   ?? null,
    };
    if (shouldRegenerateNarrative(current, narrativeState, nowMs)) {
        const text = current.freshness === "stale"
            ? "Step outside and the air feels uncertain, like a paused conversation. The latest signals are old enough that the moment may have shifted. The weather is still listening, and we are listening with it."
            : getWeatherPhrase(tempC, humidity);
        narrativeState = { ...current, text, generatedAtMs: nowMs };
        saveNarrativeStateToStorage();
    }
    weatherPhrase.textContent = narrativeState.text;
}

// ── Derived atmospheric metrics ────────────────────────────────────
function dewPointC(tempC, humidity) {
    const a = 17.625, b = 243.04;
    const alpha = Math.log(humidity / 100) + (a * tempC) / (b + tempC);
    return (b * alpha) / (a - alpha);
}

function vpdKpa(tempC, humidity) {
    const es = 0.6108 * Math.exp(17.27 * tempC / (tempC + 237.3));
    return Math.max(0, es - es * humidity / 100);
}

function updateAdvancedStats() {
    const dewEl  = document.getElementById("stat-dewpoint");
    const presEl = document.getElementById("stat-pressure");
    const visEl  = document.getElementById("stat-visibility");
    const gustEl = document.getElementById("stat-gusts");
    const vpdEl  = document.getElementById("stat-vpd");

    if (dewEl) {
        if (currentTempC !== null && avgHumidity !== null) {
            const dpC = dewPointC(currentTempC, avgHumidity);
            dewEl.textContent = isCelsius()
                ? `${dpC.toFixed(1)}°C`
                : `${Math.round(dpC * 9 / 5 + 32)}°F`;
        } else {
            dewEl.textContent = "--";
        }
    }

    if (presEl) {
        presEl.textContent = nwsData?.pressureHpa != null
            ? `${Math.round(nwsData.pressureHpa)} hPa`
            : "--";
    }

    if (visEl) {
        if (nwsData?.visibilityKm != null) {
            const miles = nwsData.visibilityKm / 1.60934;
            visEl.textContent = miles >= 10
                ? `${Math.round(miles)} mi`
                : `${miles.toFixed(1)} mi`;
        } else {
            visEl.textContent = "--";
        }
    }

    if (gustEl) {
        if (nwsData?.windGustMph != null) {
            gustEl.textContent = `${Math.round(nwsData.windGustMph)} mph`;
        } else if (nwsData) {
            gustEl.textContent = "None";
        } else {
            gustEl.textContent = "--";
        }
    }

    if (vpdEl) {
        if (currentTempC !== null && avgHumidity !== null) {
            vpdEl.textContent = `${vpdKpa(currentTempC, avgHumidity).toFixed(2)} kPa`;
        } else {
            vpdEl.textContent = "--";
        }
    }
}

// ── Background gradient ────────────────────────────────────────────
function setTemperatureBackground(tempC) {
    if (tempC === null) {
        document.body.style.background = "linear-gradient(135deg, #1a2a6c, #3498db, #2ecc71)";
        updateWeatherNarrative(tempC, avgHumidity);
        return;
    }

    let c1, c2, c3;
    if      (tempC <=  0) { c1="#0a192f"; c2="#1a2a6c"; c3="#2c3e90"; }
    else if (tempC <=  5) { c1="#1a2a6c"; c2="#2c3e90"; c3="#3498db"; }
    else if (tempC <= 10) { c1="#1a2a6c"; c2="#2980b9"; c3="#3498db"; }
    else if (tempC <= 15) { c1="#3498db"; c2="#2980b9"; c3="#27ae60"; }
    else if (tempC <= 20) { c1="#3498db"; c2="#27ae60"; c3="#2ecc71"; }
    else if (tempC <= 25) { c1="#27ae60"; c2="#2ecc71"; c3="#f1c40f"; }
    else if (tempC <= 28) { c1="#2ecc71"; c2="#f1c40f"; c3="#f39c12"; }
    else if (tempC <= 30) { c1="#f1c40f"; c2="#f39c12"; c3="#e67e22"; }
    else if (tempC <= 33) { c1="#f39c12"; c2="#e67e22"; c3="#e74c3c"; }
    else                  { c1="#e67e22"; c2="#e74c3c"; c3="#c0392b"; }

    document.body.style.background = `linear-gradient(135deg, ${c1}, ${c2}, ${c3})`;
    updateWeatherNarrative(tempC, avgHumidity);
}

// ── Sensor status ──────────────────────────────────────────────────
function updateSensorStatus() {
    const unit = tempUnitStr();

    for (const chId of VALID_CHANNELS) {
        const ch = currentChannels ? currentChannels[String(chId)] : null;

        const isOnline  = ch ? ch.online : false;
        const isBattLow = isOnline && ch.batteryOk === false;
        const statusClass = isOnline ? (isBattLow ? "warning" : "online") : "offline";
        const battLabel = ch?.batteryOk === true  ? "Battery OK"
                        : ch?.batteryOk === false ? "Battery LOW"
                        : "Battery unknown";

        const battEl = document.getElementById(`sensor-batt-${chId}`);
        if (battEl) battEl.className = `fas fa-circle sensor-batt-icon ${statusClass}`;

        const latest = ch?.recentReadings?.[0];

        const tEl = document.getElementById(`sensor-temp-${chId}`);
        if (tEl) tEl.textContent = latest?.tempC != null ? `${convertTemp(latest.tempC)}${unit}` : "--";

        const hEl = document.getElementById(`sensor-hum-${chId}`);
        if (hEl) hEl.textContent = latest?.humidity != null ? `${latest.humidity.toFixed(1)}%` : "--%";

        const ttEl = document.getElementById(`sensor-tooltip-${chId}`);
        if (ttEl) {
            const readings = ch?.recentReadings ?? [];
            const rows = readings.length === 0
                ? [
                    `<div class="tooltip-battery"><i class="fas fa-circle ${statusClass}"></i> ${battLabel}</div>`,
                    `<div class="tooltip-row" style="color:rgba(255,255,255,0.3)">No recent data</div>`,
                  ]
                : [
                    `<div class="tooltip-battery"><i class="fas fa-circle ${statusClass}"></i> ${battLabel}</div>`,
                    `<div class="tooltip-header"><span>Time</span><span>Temp</span><span>Humid</span></div>`,
                    ...readings.map(r => {
                        const t  = new Date(r.time * 1000).toLocaleTimeString([], {
                            hour: "2-digit", minute: "2-digit", timeZone: TIMESTAMP_ZONE,
                        });
                        const tv = r.tempC    != null ? `${convertTemp(r.tempC)}${unit}` : "--";
                        const hv = r.humidity != null ? `${r.humidity.toFixed(1)}%`      : "--";
                        return `<div class="tooltip-row"><span>${t}</span><span class="col-temp">${tv}</span><span>${hv}</span></div>`;
                    }),
                  ];
            ttEl.innerHTML = rows.join("");
        }
    }
}

// ── Temperature unit toggle ────────────────────────────────────────
function updateTemperatureDisplay() {
    if (currentTempC !== null) tempValue.textContent = convertTemp(currentTempC);
    updateSensorStatus();
    updateFeelsLike();
    updateAdvancedStats();
}

celsiusBtn.addEventListener("click", () => {
    if (!celsiusBtn.classList.contains("active")) {
        celsiusBtn.classList.add("active");
        fahrenheitBtn.classList.remove("active");
        tempUnit.textContent = "°C";
        updateTemperatureDisplay();
    }
});

fahrenheitBtn.addEventListener("click", () => {
    if (!fahrenheitBtn.classList.contains("active")) {
        fahrenheitBtn.classList.add("active");
        celsiusBtn.classList.remove("active");
        tempUnit.textContent = "°F";
        updateTemperatureDisplay();
    }
});

// ── NWS helpers ────────────────────────────────────────────────────
function parseWindSpeedMph(windStr) {
    if (!windStr) return 0;
    const parts = String(windStr).toLowerCase().replace("mph","").split("to");
    const nums  = parts.map(p => parseFloat(p.trim())).filter(n => !isNaN(n));
    return nums.length ? nums.reduce((a,b) => a+b, 0) / nums.length : 0;
}

function windBandFromMph(mph) {
    if (mph <=  2) return "calm";
    if (mph <=  8) return "light";
    if (mph <= 15) return "moderate";
    if (mph <= 24) return "breezy";
    return "windy";
}

function skyConditionFromForecast(shortForecast) {
    const s = (shortForecast || "").toLowerCase();
    if (s.includes("fog")  || s.includes("mist"))                              return "fog";
    if (s.includes("thunder"))                                                  return "thunderstorm";
    if (s.includes("heavy rain") || s.includes("heavy shower"))                return "heavy-rain";
    if (s.includes("rain") || s.includes("shower") || s.includes("drizzle"))  return "rain";
    if (s.includes("snow") || s.includes("flurr") || s.includes("sleet"))     return "snow";
    if (s.includes("overcast"))                                                 return "overcast";
    if (s.includes("mostly cloudy"))                                            return "mostly-cloudy";
    if (s.includes("partly cloudy") || s.includes("mostly clear"))             return "partly-cloudy";
    if (s.includes("sunny") || s.includes("clear") || s.includes("fair"))     return "clear";
    return null;
}

// ── Fetch NWS ──────────────────────────────────────────────────────
function fetchNWSData() {
    fetch(`${NWS_DATA_FILE}?t=${Date.now()}`, { cache: "no-store" })
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then(json => {
            const c = json?.current;
            if (!c) return;

            const fetchedAt = json.fetchedAt ? json.fetchedAt * 1000 : 0;
            if (Date.now() - fetchedAt > NWS_STALE_AFTER_MS) {
                console.warn("[nws] Cached forecast is stale — ignoring");
                return;
            }

            const windSpeedMph = parseWindSpeedMph(
                typeof c.windSpeedMph === "number" ? String(c.windSpeedMph) : c.windSpeedMph
            );
            const windBand     = windBandFromMph(windSpeedMph);
            const skyCondition = skyConditionFromForecast(c.shortForecast);
            const precipProb   = typeof c.probabilityOfPrecipitation === "number"
                ? c.probabilityOfPrecipitation : 0;

            const prevWindBand = nwsData?.windBand     ?? null;
            const prevSky      = nwsData?.skyCondition ?? null;

            nwsData = {
                windSpeedMph,
                windGustMph:   typeof c.windGustMph === "number" ? c.windGustMph : null,
                windDirection: c.windDirection   || "",
                windBand,
                skyCondition,
                precipProb,
                shortForecast: c.shortForecast   || "",
                isDaytime:     c.isDaytime !== false,
                pressureHpa:   json.observations?.pressureHpa  ?? null,
                visibilityKm:  json.observations?.visibilityKm ?? null,
            };

            updateWeatherIcon();
            updateFeelsLike();
            updateAdvancedStats();

            if (windBand !== prevWindBand || skyCondition !== prevSky) {
                updateWeatherNarrative(currentTempC, avgHumidity);
            }
        })
        .catch(err => console.warn("[nws] Could not load forecast cache:", err));
}

// ── Process current.json ───────────────────────────────────────────
function processCurrentJSON(data) {
    const agg = data.aggregate || {};
    currentTempC    = agg.tempC    ?? null;
    avgHumidity     = agg.humidity ?? null;
    currentChannels = data.channels || null;

    tempValue.textContent     = currentTempC  !== null ? convertTemp(currentTempC)      : "--";
    humidityValue.textContent = avgHumidity   !== null ? avgHumidity.toFixed(1)         : "--";

    const generatedAtMs = (data.generatedAt || 0) * 1000;
    updateTime.textContent = generatedAtMs
        ? new Date(generatedAtMs).toLocaleTimeString([], {
              hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: TIMESTAMP_ZONE,
          })
        : "--";

    updateTrendArrow(agg.tempTrendCPerMin ?? null);
    setTemperatureBackground(currentTempC);
    updateSensorStatus();
    updateFeelsLike();
    updateAdvancedStats();

    loadingIndicator.style.display = "none";
}

// ── Fetch current.json ─────────────────────────────────────────────
function fetchCurrentData() {
    fetch(`current.json?t=${Date.now()}`, { cache: "no-store" })
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then(data => processCurrentJSON(data))
        .catch(err => console.warn("[weather] Could not load current.json:", err));
}

// ── Init ───────────────────────────────────────────────────────────
loadNarrativeStateFromStorage();
updateWeatherIcon();
fetchCurrentData();
setInterval(fetchCurrentData, UPDATE_INTERVAL);
fetchNWSData();
setInterval(fetchNWSData, NWS_FETCH_INTERVAL_MS);
