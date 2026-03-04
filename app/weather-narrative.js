(function (global) {
  "use strict";

  // Vocab and salience rules live in weather-narrative-config.js.
  // This file is the engine: RNG, context building, and narrative assembly.
  const _cfg = global.WeatherNarrativeConfig;
  if (!_cfg) {
    console.error("WeatherNarrative: WeatherNarrativeConfig not loaded.");
    return;
  }
  const vocab = _cfg.vocab;

  const RECENT_LIMIT = 12;
  const recentByDay = {};
  let generationCounter = 0;

  // ---------------------------------------------------------------------------
  // RNG utilities
  // ---------------------------------------------------------------------------

  function hashString(str) {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash +=
        (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return hash >>> 0;
  }

  function mulberry32(seed) {
    let t = seed >>> 0;
    return function () {
      t += 0x6d2b79f5;
      let r = Math.imul(t ^ (t >>> 15), t | 1);
      r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(items, rand) {
    return items[Math.floor(rand() * items.length)];
  }

  function maybe(prob, rand) {
    return rand() < prob;
  }

  function cap(s) {
    if (!s) return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // Ensure string ends with a sentence-ending punctuation mark.
  function period(s) {
    if (!s) return s;
    const t = s.trimEnd();
    return /[.!?]$/.test(t) ? t : t + ".";
  }

  // Capitalize and ensure period — the most common transform for standalone sentences.
  function sent(s) {
    return period(cap(s));
  }

  // ---------------------------------------------------------------------------
  // Date / time helpers
  // ---------------------------------------------------------------------------

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function getZonedParts(date, timeZone) {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hour12: false,
    });
    const map = {};
    for (const p of dtf.formatToParts(date)) {
      if (p.type !== "literal") map[p.type] = p.value;
    }
    return {
      year: Number(map.year),
      month: Number(map.month),
      day: Number(map.day),
      hour: Number(map.hour),
    };
  }

  function getDayKey(date, timeZone) {
    const z = getZonedParts(date, timeZone);
    return `${z.year}-${pad2(z.month)}-${pad2(z.day)}`;
  }

  function getTimeBand(hour) {
    if (hour < 5) return "late-night";
    if (hour < 8) return "dawn";
    if (hour < 12) return "morning";
    if (hour < 17) return "afternoon";
    if (hour < 21) return "evening";
    return "night";
  }

  function getSeason(month) {
    // month: 1-indexed (Jan=1)
    if (month === 12 || month <= 2) return "winter";
    if (month <= 5) return "spring";
    if (month <= 8) return "summer";
    return "autumn";
  }

  function getMoonPhase(date) {
    const phaseDays = 29.53058867;
    const knownNew = Date.UTC(2000, 0, 6, 18, 14, 0);
    const pos =
      (((date.getTime() - knownNew) / 86400000) % phaseDays + phaseDays) %
      phaseDays;
    const f = pos / phaseDays;
    if (f < 0.03 || f >= 0.97) return "new moon";
    if (f < 0.22) return "waxing crescent";
    if (f < 0.28) return "first quarter";
    if (f < 0.47) return "waxing gibbous";
    if (f < 0.53) return "full moon";
    if (f < 0.72) return "waning gibbous";
    if (f < 0.78) return "last quarter";
    return "waning crescent";
  }

  function isMoonNotable(phase) {
    return (
      phase === "full moon" ||
      phase === "new moon" ||
      phase === "first quarter" ||
      phase === "last quarter"
    );
  }

  // ---------------------------------------------------------------------------
  // Band classifiers
  // ---------------------------------------------------------------------------

  function getTempBand(tempC) {
    if (tempC <= 0) return "freezing";
    if (tempC <= 7) return "cold";
    if (tempC <= 14) return "cool";
    if (tempC <= 22) return "mild";
    if (tempC <= 28) return "warm";
    if (tempC <= 33) return "hot";
    return "scorching";
  }

  function getHumidityBand(h) {
    if (h < 30) return "dry";
    if (h < 45) return "comfortable";
    if (h < 65) return "balanced";
    if (h < 80) return "humid";
    return "saturated";
  }

  // ---------------------------------------------------------------------------
  // Anti-repetition
  // ---------------------------------------------------------------------------

  function rememberPhrase(dayKey, phrase) {
    if (!recentByDay[dayKey]) recentByDay[dayKey] = [];
    recentByDay[dayKey].push(phrase);
    if (recentByDay[dayKey].length > RECENT_LIMIT) recentByDay[dayKey].shift();
  }

  function pickWithoutRecent(dayKey, generator) {
    const recent = recentByDay[dayKey] || [];
    let candidate = generator();
    for (let i = 0; i < 10; i++) {
      if (!recent.includes(candidate)) break;
      candidate = generator();
    }
    rememberPhrase(dayKey, candidate);
    return candidate;
  }

  // ---------------------------------------------------------------------------
  // Context builder
  // ---------------------------------------------------------------------------

  function buildContext(tempC, humidity, date, options, rand) {
    const timeZone =
      options && options.timeZone
        ? options.timeZone
        : Intl.DateTimeFormat().resolvedOptions().timeZone;
    const zoned = getZonedParts(date, timeZone);
    const timeBand = getTimeBand(zoned.hour);
    const season = getSeason(zoned.month);
    const moon = getMoonPhase(date);
    const tempBand = getTempBand(tempC);
    const humidityBand = getHumidityBand(humidity);

    const wind = (options && options.wind) || null;
    const windBand = wind ? wind.band || "calm" : null;
    const windDir = wind ? wind.direction || "" : "";
    const skyCondition = (options && options.skyCondition) || null;
    const precipProb = (options && options.precipProb) || 0;

    const isNight =
      timeBand === "night" ||
      timeBand === "late-night" ||
      timeBand === "evening";
    const isFullMoon = moon === "full moon";
    const isMoonLead =
      isNight &&
      isFullMoon &&
      (skyCondition === "clear" || skyCondition === null);
    // Full moon on a clear night always leads. Other notable phases are probabilistic.
    const moonVisible =
      isMoonLead || (isNight && isMoonNotable(moon) && maybe(0.6, rand));
    const hasSkyData = skyCondition !== null;
    const isRaining =
      skyCondition === "rain" ||
      skyCondition === "heavy-rain" ||
      skyCondition === "thunderstorm";
    const isFoggy = skyCondition === "fog";
    const isSnowing = skyCondition === "snow";
    const isDramaticallyWindy = windBand === "breezy" || windBand === "windy";
    const isExtremeTemp =
      tempBand === "freezing" ||
      tempBand === "scorching" ||
      tempBand === "hot";
    const isPleasant =
      (tempBand === "mild" || tempBand === "cool") &&
      !isRaining &&
      !isFoggy &&
      !isSnowing &&
      (!windBand || windBand === "calm" || windBand === "light");

    return {
      tempC,
      humidity,
      tempBand,
      humidityBand,
      timeBand,
      season,
      moon,
      isFullMoon,
      isMoonLead,
      moonVisible,
      wind,
      windBand,
      windDir,
      skyCondition,
      precipProb,
      hasSkyData,
      isRaining,
      isFoggy,
      isSnowing,
      isDramaticallyWindy,
      isExtremeTemp,
      isPleasant,
    };
  }

  // ---------------------------------------------------------------------------
  // Vocabulary pickers with wind-direction interpolation
  // ---------------------------------------------------------------------------

  const CARDINAL_NAMES = {
    N: "north", NNE: "north-northeast", NE: "northeast", ENE: "east-northeast",
    E: "east", ESE: "east-southeast", SE: "southeast", SSE: "south-southeast",
    S: "south", SSW: "south-southwest", SW: "southwest", WSW: "west-southwest",
    W: "west", WNW: "west-northwest", NW: "northwest", NNW: "north-northwest",
  };

  function expandDir(dir) {
    return CARDINAL_NAMES[dir] || dir;
  }

  function pickWindPhrase(windBand, windDir, rand) {
    const pool = vocab.windBody[windBand] || vocab.windBody["calm"];
    const raw = pick(pool, rand);
    return raw.replace(/\{dir\}/g, expandDir(windDir) || "");
  }

  function pickSkyPhrase(skyCondition, rand) {
    if (!skyCondition) return null;
    const pool = vocab.skyContext[skyCondition];
    return pool ? pick(pool, rand) : null;
  }

  function pickMovementFeel(tempBand, windBand, skyCondition, rand) {
    const byTemp = vocab.movementFeel[tempBand];
    if (!byTemp) return null;
    if ((skyCondition === "rain" || skyCondition === "heavy-rain") && vocab.movementRain) {
      return pick(vocab.movementRain, rand);
    }
    if (byTemp[windBand]) return byTemp[windBand];
    if (windBand === "breezy" || windBand === "windy") {
      if (byTemp["windy"]) return byTemp["windy"];
      if (byTemp["breezy"]) return byTemp["breezy"];
    }
    return byTemp["default"] || byTemp[Object.keys(byTemp)[0]];
  }

  function pickSeasonalNote(season, tempBand, rand) {
    const bySeason = vocab.seasonalNote[season];
    if (!bySeason) return null;
    const note = bySeason[tempBand];
    return note || null;
  }

  // Returns a moon-as-supporting-character sentence, or null if moon isn't visible.
  function pickMoonSupport(ctx, rand) {
    if (!ctx.moonVisible) return null;
    return pick(vocab.moonContext, rand).replace(/\{moon\}/g, ctx.moon);
  }

  // ---------------------------------------------------------------------------
  // Narrative arc templates
  // ---------------------------------------------------------------------------

  function templateRainLead(ctx, rand) {
    // Opens with rain, blends temp, closes with what movement means
    const timeOpener = pick(vocab.openerByTime[ctx.timeBand], rand);
    const rainPhrase = pickSkyPhrase(ctx.skyCondition, rand) || "Rain is likely.";
    const isStorm = ctx.skyCondition === "thunderstorm";
    const rainTemp = isStorm
      ? pick(vocab.thunderstormTexture, rand)
      : pick(vocab.rainTexture[ctx.tempBand] || vocab.rainTexture["mild"], rand);
    const movement = isStorm
      ? null // don't invite movement during a thunderstorm
      : pickMovementFeel(ctx.tempBand, ctx.windBand, ctx.skyCondition, rand);
    // Join opener + rain phrase with colon so opener doesn't strand as a fragment
    const parts = [
      sent(`${timeOpener}: ${rainPhrase}`),
      sent(rainTemp),
    ];
    if (movement && maybe(0.7, rand)) parts.push(sent(movement));
    return parts.join(" ");
  }

  function templateFogScene(ctx, rand) {
    // Fog as primary character — sensory, close, intimate
    const timeOpener = pick(vocab.openerByTime[ctx.timeBand], rand);
    const fogDetail = pick(vocab.fogTexture, rand);
    const tempPhrase = pick(vocab.tempBody[ctx.tempBand], rand);
    const fogLead = pick(vocab.fogLead || ["the fog has settled in"], rand);
    return `${timeOpener}: ${fogLead}. ${sent(fogDetail)} ${sent(tempPhrase)}`;
  }

  function templateSnowScene(ctx, rand) {
    // Snow as transformation — stillness, light, sound
    const timeOpener = pick(vocab.openerByTime[ctx.timeBand], rand);
    const snowPhrase = pickSkyPhrase("snow", rand);
    const snowDetail = pick(vocab.snowTexture, rand);
    const tempPhrase = pick(vocab.tempBody[ctx.tempBand], rand);
    const windLine =
      ctx.windBand && ctx.windBand !== "calm"
        ? sent(pickWindPhrase(ctx.windBand, ctx.windDir, rand))
        : null;
    const parts = [
      sent(`${timeOpener}: ${snowPhrase}`),
      sent(snowDetail),
      sent(tempPhrase),
    ];
    if (windLine) parts.push(windLine);
    return parts.join(" ");
  }

  function templateClearNight(ctx, rand) {
    // Full moon leads with its own voice; other phases use the generic moon context.
    const moonPhrase = ctx.isFullMoon
      ? pick(vocab.moonLead.full, rand)
      : pick(vocab.moonContext, rand).replace(/\{moon\}/g, ctx.moon);
    const tempPhrase = pick(vocab.tempBody[ctx.tempBand], rand);
    const windPhrase =
      ctx.windBand && ctx.windBand !== "calm"
        ? pickWindPhrase(ctx.windBand, ctx.windDir, rand)
        : null;
    const movement = maybe(0.5, rand)
      ? pickMovementFeel(ctx.tempBand, ctx.windBand, ctx.skyCondition, rand)
      : null;
    // Full moon gets a clean two-sentence open; other phases use the "Out here" bridge.
    const opening = ctx.isFullMoon
      ? `${sent(moonPhrase)} ${cap(tempPhrase)}.`
      : `${moonPhrase}. Out here, ${tempPhrase}.`;
    const parts = [opening];
    if (windPhrase) parts.push(sent(windPhrase));
    if (movement) parts.push(sent(movement));
    return parts.join(" ");
  }

  function templateWindLead(ctx, rand) {
    // Wind is the main character — direction, sky context, what it means for body
    const windPhrase = pickWindPhrase(ctx.windBand, ctx.windDir, rand);
    const skyPhrase = ctx.hasSkyData
      ? pickSkyPhrase(ctx.skyCondition, rand)
      : null;
    const tempPhrase = pick(vocab.tempBody[ctx.tempBand], rand);
    const movement = pickMovementFeel(ctx.tempBand, ctx.windBand, ctx.skyCondition, rand);
    const moonLine = pickMoonSupport(ctx, rand);
    const parts = [
      skyPhrase
        ? sent(`${cap(windPhrase)}, ${skyPhrase}`)
        : sent(cap(windPhrase)),
      sent(tempPhrase),
    ];
    if (movement && maybe(0.65, rand)) parts.push(sent(movement));
    if (moonLine && maybe(0.45, rand)) parts.push(sent(moonLine));
    return parts.join(" ");
  }

  function templateExtremeCold(ctx, rand) {
    // Lead with the physical sensation of cold, then practical
    const timeOpener = pick(vocab.openerByTime[ctx.timeBand], rand);
    const tempPhrase = pick(vocab.tempBody[ctx.tempBand], rand);
    const windPhrase =
      ctx.windBand && ctx.windBand !== "calm"
        ? pickWindPhrase(ctx.windBand, ctx.windDir, rand)
        : null;
    const seasonNote = pickSeasonalNote(ctx.season, ctx.tempBand, rand);
    const movement = pickMovementFeel(ctx.tempBand, ctx.windBand, ctx.skyCondition, rand);
    const parts = [sent(`${timeOpener} — ${tempPhrase}`)];
    if (windPhrase) parts.push(sent(windPhrase));
    if (movement) parts.push(sent(movement));
    if (seasonNote && maybe(0.6, rand)) parts.push(sent(seasonNote));
    return parts.join(" ");
  }

  function templateExtremeHeat(ctx, rand) {
    // Heat is relentless — lead with sensation, close with practical truth
    const timeOpener = pick(vocab.openerByTime[ctx.timeBand], rand);
    const tempPhrase = pick(vocab.tempBody[ctx.tempBand], rand);
    const humidPhrase = pick(vocab.humidityBody[ctx.humidityBand], rand);
    const movement = pickMovementFeel(ctx.tempBand, ctx.windBand, ctx.skyCondition, rand);
    const seasonNote = pickSeasonalNote(ctx.season, ctx.tempBand, rand);
    const windPhrase =
      ctx.windBand && ctx.windBand !== "calm"
        ? pickWindPhrase(ctx.windBand, ctx.windDir, rand)
        : null;
    const parts = [sent(`${timeOpener}: ${tempPhrase}`)];
    if (windPhrase) parts.push(sent(windPhrase));
    parts.push(sent(humidPhrase));
    if (movement) parts.push(sent(movement));
    if (seasonNote && maybe(0.5, rand)) parts.push(sent(seasonNote));
    return parts.join(" ");
  }

  function templatePleasantWalk(ctx, rand) {
    // Mild, open, inviting — built around the pleasure of being outside
    const timeOpener = pick(vocab.openerByTime[ctx.timeBand], rand);
    const skyPhrase = ctx.hasSkyData
      ? pickSkyPhrase(ctx.skyCondition, rand)
      : null;
    const tempPhrase = pick(vocab.tempBody[ctx.tempBand], rand);
    const movement = pickMovementFeel(ctx.tempBand, ctx.windBand, ctx.skyCondition, rand);
    const seasonNote = pickSeasonalNote(ctx.season, ctx.tempBand, rand);
    const humidPhrase = maybe(0.4, rand)
      ? pick(vocab.humidityBody[ctx.humidityBand], rand)
      : null;
    const windPhrase =
      ctx.windBand && ctx.windBand !== "calm"
        ? pickWindPhrase(ctx.windBand, ctx.windDir, rand)
        : null;
    const moonLine = pickMoonSupport(ctx, rand);
    const opening = skyPhrase
      ? `${timeOpener}, ${skyPhrase} — ${tempPhrase}.`
      : `${timeOpener}: ${tempPhrase}.`;
    const parts = [opening];
    if (windPhrase) parts.push(sent(windPhrase));
    if (humidPhrase) parts.push(sent(humidPhrase));
    if (movement) parts.push(sent(movement));
    if (seasonNote && maybe(0.5, rand)) parts.push(sent(seasonNote));
    if (moonLine && maybe(0.45, rand)) parts.push(sent(moonLine));
    return parts.join(" ");
  }

  function templateSeasonalMoment(ctx, rand) {
    // Fallback — weaves time, temp, sky, and season into a grounded moment
    const timeOpener = pick(vocab.openerByTime[ctx.timeBand], rand);
    const tempPhrase = pick(vocab.tempBody[ctx.tempBand], rand);
    const humidPhrase = pick(vocab.humidityBody[ctx.humidityBand], rand);
    const skyPhrase = ctx.hasSkyData
      ? pickSkyPhrase(ctx.skyCondition, rand)
      : null;
    const windPhrase =
      ctx.windBand && ctx.windBand !== "calm"
        ? pickWindPhrase(ctx.windBand, ctx.windDir, rand)
        : null;
    const seasonNote = pickSeasonalNote(ctx.season, ctx.tempBand, rand);
    const movement = maybe(0.5, rand)
      ? pickMovementFeel(ctx.tempBand, ctx.windBand, ctx.skyCondition, rand)
      : null;
    const moonLine = pickMoonSupport(ctx, rand);
    const opening = skyPhrase
      ? `${timeOpener}, ${skyPhrase} — ${tempPhrase}.`
      : `${timeOpener}: ${tempPhrase}.`;
    const parts = [opening];
    if (windPhrase) parts.push(sent(windPhrase));
    parts.push(sent(humidPhrase));
    if (movement) parts.push(sent(movement));
    if (seasonNote) parts.push(sent(seasonNote));
    if (moonLine && maybe(0.45, rand)) parts.push(sent(moonLine));
    return parts.join(" ");
  }

  // ---------------------------------------------------------------------------
  // Writer voice templates
  // ---------------------------------------------------------------------------

  function templateThoreau(ctx, rand, writer) {
    const wv = writer.vocab;
    const openers = wv.opener[ctx.timeBand] || wv.opener["morning"];
    const opener = pick(openers, rand);
    const tempDetail = pick(wv.tempBody[ctx.tempBand], rand);
    const windPhrase =
      ctx.windBand && ctx.windBand !== "calm"
        ? pickWindPhrase(ctx.windBand, ctx.windDir, rand)
        : null;
    const moonLine =
      ctx.isFullMoon && wv.moonFull ? pick(wv.moonFull, rand) : null;
    const observation = pick(wv.observation, rand);
    const closingPool = wv.closing[ctx.season] || wv.closing["autumn"];
    const closing = pick(closingPool, rand);

    const parts = [opener + " " + tempDetail + "."];
    if (windPhrase && maybe(0.6, rand)) parts.push(sent(windPhrase));
    if (moonLine && maybe(0.5, rand)) parts.push(sent(moonLine));
    parts.push(sent(observation));
    parts.push(sent(closing));
    return parts.join(" ");
  }

  function templateDickinson(ctx, rand, writer) {
    const wv = writer.vocab;
    let conditionLine;
    if (ctx.isMoonLead || (ctx.moonVisible && ctx.isFullMoon)) {
      conditionLine = pick(wv.moon, rand);
    } else if (ctx.skyCondition && wv.sky[ctx.skyCondition]) {
      conditionLine = pick(wv.sky[ctx.skyCondition], rand);
    } else {
      conditionLine = pick(wv.sky.default, rand);
    }
    const tempLine = pick(wv.tempBody[ctx.tempBand] || wv.tempBody["mild"], rand);
    const closing = pick(wv.closing, rand);
    return [conditionLine, tempLine, closing].join(" ");
  }

  function templateDfw(ctx, rand, writer) {
    const wv = writer.vocab;
    let mainKey = "default";
    if (ctx.isMoonLead)                                              mainKey = "moonLead";
    else if (ctx.isFoggy)                                            mainKey = "fog";
    else if (ctx.isRaining || ctx.skyCondition === "heavy-rain")     mainKey = "rain";
    else if (ctx.isSnowing)                                          mainKey = "snow";
    else if (ctx.tempBand === "freezing" || ctx.tempBand === "cold") mainKey = "cold";
    else if (ctx.tempBand === "cool")                                mainKey = "cool";
    else if (ctx.tempBand === "mild")                                mainKey = "mild";
    else if (ctx.tempBand === "warm")                                mainKey = "warm";
    else if (ctx.tempBand === "hot" || ctx.tempBand === "scorching") mainKey = "hot";
    const mainPool = wv.main[mainKey] || wv.main["default"];
    return sent(pick(mainPool, rand)) + " " + sent(pick(wv.closing, rand));
  }

  // Maps writer template names (from writers config) to assembly functions.
  const WRITER_TEMPLATE_FNS = {
    thoreau:   templateThoreau,
    dickinson: templateDickinson,
    dfw:       templateDfw,
  };

  function selectWriter(rand) {
    const writers = _cfg.writers;
    if (!writers || !maybe(writers.activationChance, rand)) return null;
    return pick(writers.voices, rand);
  }

  // ---------------------------------------------------------------------------
  // Salience resolver — reads ordering from config, not hard-coded
  // ---------------------------------------------------------------------------

  // Maps condition names (used in salience config) to ctx predicates.
  const CONDITIONS = {
    thunderstorm: function (ctx) { return ctx.skyCondition === "thunderstorm"; },
    snow:         function (ctx) { return ctx.isSnowing; },
    fog:          function (ctx) { return ctx.isFoggy; },
    moonLead:     function (ctx) { return ctx.isMoonLead; },
    heavyRain:    function (ctx) { return ctx.skyCondition === "heavy-rain"; },
    rain:         function (ctx) { return ctx.skyCondition === "rain" || ctx.precipProb >= 50; },
    windy:        function (ctx) { return ctx.isDramaticallyWindy; },
    freezing:     function (ctx) { return ctx.tempBand === "freezing"; },
    hot:          function (ctx) { return ctx.tempBand === "scorching" || ctx.tempBand === "hot"; },
    pleasant:     function (ctx) { return ctx.isPleasant; },
    default:      function ()    { return true; },
  };

  // Maps template names (used in salience config) to assembly functions.
  const TEMPLATE_FNS = {
    rain:        templateRainLead,
    snow:        templateSnowScene,
    fog:         templateFogScene,
    clearNight:  templateClearNight,
    wind:        templateWindLead,
    extremeCold: templateExtremeCold,
    extremeHeat: templateExtremeHeat,
    pleasant:    templatePleasantWalk,
    seasonal:    templateSeasonalMoment,
  };

  // Boot-time validation — warn on config/engine key mismatches so typos surface immediately.
  (function () {
    (_cfg.salience || []).forEach(function (rule) {
      if (!(rule.when in CONDITIONS))
        console.warn('WeatherNarrative: unknown salience condition "' + rule.when + '"');
      if (!(rule.template in TEMPLATE_FNS))
        console.warn('WeatherNarrative: unknown salience template "' + rule.template + '"');
    });
    var voices = (_cfg.writers && _cfg.writers.voices) || [];
    voices.forEach(function (voice) {
      if (!(voice.template in WRITER_TEMPLATE_FNS))
        console.warn('WeatherNarrative: unknown writer template "' + voice.template + '"');
    });
  }());

  function resolveSalience(ctx) {
    const rules = _cfg.salience;
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      const cond = CONDITIONS[rule.when];
      if (cond && cond(ctx)) {
        return TEMPLATE_FNS[rule.template] || templateSeasonalMoment;
      }
    }
    return templateSeasonalMoment;
  }

  // ---------------------------------------------------------------------------
  // Seed + generation
  // ---------------------------------------------------------------------------

  function createSeed(dayKey, tempC, humidity) {
    generationCounter += 1;
    const sig = `${dayKey}|${Math.round(tempC * 10)}|${Math.round(humidity)}|${generationCounter}`;
    return hashString(sig);
  }

  function createPhrase(tempC, humidity, date, options) {
    const timeZone =
      options && options.timeZone
        ? options.timeZone
        : Intl.DateTimeFormat().resolvedOptions().timeZone;
    const dayKey = getDayKey(date, timeZone);
    const rand = mulberry32(createSeed(dayKey, tempC, humidity));
    const ctx = buildContext(tempC, humidity, date, options, rand);
    const writer = selectWriter(rand);
    if (writer) {
      const writerTemplate = WRITER_TEMPLATE_FNS[writer.template];
      if (writerTemplate) return writerTemplate(ctx, rand, writer);
    }
    const template = resolveSalience(ctx);
    return template(ctx, rand);
  }

  function generate(tempC, humidity, date, options) {
    if (tempC === null || humidity === null) {
      return "Waiting for enough sensor data to describe conditions.";
    }
    const now = date || new Date();
    const timeZone =
      options && options.timeZone
        ? options.timeZone
        : Intl.DateTimeFormat().resolvedOptions().timeZone;
    const dayKey = getDayKey(now, timeZone);
    // Prune stale day keys — prevents unbounded growth in long-running sessions.
    Object.keys(recentByDay).forEach(function (k) {
      if (k !== dayKey) delete recentByDay[k];
    });
    return pickWithoutRecent(dayKey, function () {
      return createPhrase(tempC, humidity, now, options);
    });
  }

  global.WeatherNarrative = { generate };
})(window);
