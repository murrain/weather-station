(function (global) {
  "use strict";

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
  // Vocabulary
  // ---------------------------------------------------------------------------

  const vocab = {
    // Time-of-day scene openers — equal weight, varied structure
    openerByTime: {
      "late-night": [
        "Late night leans in close",
        "Past midnight, the world exhales",
        "In the small hours, everything goes quiet and strange",
        "After the last porch light blinks out",
        "The night has settled into its deepest register",
        "At this hour the streets belong to no one in particular",
      ],
      dawn: [
        "At first light",
        "In early dawn's pale gold",
        "As dawn lifts its shoulders",
        "Before daylight fully names the day",
        "At the grey-blue edge of morning",
        "The sky is barely deciding what color to be",
      ],
      morning: [
        "This morning",
        "Through morning's clear throat",
        "In the clean light of morning",
        "By this hour the day is awake and moving",
        "Morning has settled in with a steady hand",
        "The morning air has its own particular authority",
      ],
      afternoon: [
        "This afternoon",
        "In the full weight of afternoon",
        "The day stands at its tallest point",
        "Under a high and confident sun",
        "Afternoon has taken hold and isn't letting go",
        "The day is in full voice now",
      ],
      evening: [
        "This evening",
        "As evening gathers itself",
        "At the blue-hour hush",
        "Toward nightfall, when colors soften",
        "The light is doing that thing it does at dusk",
        "Evening arrives like a long exhale",
      ],
      night: [
        "Tonight",
        "After dark, the air shifts register",
        "Once the sky deepens to ink",
        "In the night air",
        "The night has its own kind of brightness",
        "At this depth of evening",
      ],
    },

    // Temperature as body sensation — what you feel, not what it is
    tempBody: {
      freezing: [
        "the cold finds your ears and cheeks before anything else",
        "the air has a hard, crystalline bite — it gets into the lungs fast",
        "your breath comes out in quick white clouds that dissolve ahead of you",
        "the cold is particular and insistent, not asking permission",
        "surfaces are sharp-cold to the touch — metal especially",
      ],
      cold: [
        "there's a brisk, clarifying chill that keeps you fully present",
        "the cold is enough to remind you it's there without being cruel about it",
        "your face knows immediately; your hands will follow",
        "it's the kind of cold that rewards movement — stand still and you feel it",
        "the air arrives direct and cool-edged against exposed skin",
      ],
      cool: [
        "the air is crisp and lightly chilled, easy to breathe",
        "there's a cool, clean freshness to every inhale",
        "the temperature is a little below comfortable — pleasantly so",
        "it's cool enough for a jacket but not cold enough to resent it",
        "the air has a silk-light edge, neither demanding nor indifferent",
      ],
      mild: [
        "the temperature is easy — neither asking too much nor giving too little",
        "it's that rare balance where the air just agrees with your skin",
        "it's mild and quietly generous, the kind of weather that goes unnoticed in the best way",
        "the air is soft, open-handed, unhurried",
        "the temperature is what you'd design if you could — just comfortable",
      ],
      warm: [
        "warmth settles into exposed skin within seconds of stepping out",
        "the air is genuinely warm, not just the absence of cold",
        "the sun's work is evident — surfaces hold heat and give it back",
        "it's warm and open, the kind of warmth that makes you want to stay outside longer than planned",
        "it's warm in a way that loosens the shoulders, slows the pace",
      ],
      hot: [
        "the heat is the first thing — bold, immediate, hard to ignore",
        "you feel it on the top of the head first, then everywhere else",
        "the air is thick with heat; even a slow walk builds it faster than it clears",
        "it's hot in a way that makes shade feel like a small, urgent mercy",
        "the heat has a weight to it, pressing gently on every exposed inch",
      ],
      scorching: [
        "the heat is aggressive — it meets you at the door and doesn't let up",
        "within a minute, the sun is working on you in a way you can feel",
        "the air shimmers slightly; surfaces in direct light are untouchable",
        "this is serious heat — the kind that demands water and shade and pacing",
        "everything outside holds stored fire right now; the world is a slow oven",
      ],
    },

    // Humidity as sensation — paired with temp context
    humidityBody: {
      dry: [
        "the air is dry enough to feel it on the lips after a minute",
        "there's a clean, papery dryness to the air — your throat notices it first",
        "low moisture means the air has a light, quick quality",
        "dryness gives the air a crispness that reads almost as altitude",
      ],
      comfortable: [
        "the moisture level is just right — the air breathes without any resistance",
        "humidity is low enough to be kind, high enough to not be arid",
        "the air feels balanced, neither clinging nor fleeing",
      ],
      balanced: [
        "the air carries a steady, neutral moisture — neither wet nor dry",
        "humidity settles into a calm middle register that the body accepts easily",
        "the moisture content is just background, which is exactly what you want",
      ],
      humid: [
        "the humidity is noticeable — the air has a soft, velvet texture",
        "moisture clings a little, slows evaporation, makes the heat feel closer",
        "you can feel the dampness gather on skin after a few minutes outside",
      ],
      saturated: [
        "the air is close to saturation — dense and warm against the face",
        "humidity wraps around you like a second layer you didn't ask for",
        "the moisture is palpable; you're breathing as much water vapor as air",
      ],
    },

    // Wind as narrative element
    windBody: {
      calm: [
        "the air is perfectly still — not a leaf stirring, not a flag moving",
        "there's no wind at all; the air sits close and undisturbed",
        "in the absence of wind, every sound carries farther than usual",
        "the stillness has a quality of held breath",
      ],
      light: [
        "a light {dir} breeze moves through, barely enough to notice but welcome",
        "there's the gentlest wind from the {dir} — more suggestion than presence",
        "a faint {dir} drift keeps the air from going stagnant",
        "the lightest {dir} breeze lifts just enough to feel on a warm cheek",
      ],
      moderate: [
        "a steady {dir} wind keeps the air in easy motion",
        "the {dir} wind is enough to ruffle hair and collar, nothing more",
        "there's a consistent {dir} breeze that makes the temperature feel a few degrees kinder",
        "a moderate {dir} wind reads through the trees in a pleasant, ongoing conversation",
      ],
      breezy: [
        "a brisk {dir} wind makes itself known immediately — hair, jacket, eyes",
        "the {dir} wind is lively; you'd feel it against your face within a block",
        "it's breezy from the {dir} in a way that demands something fastened",
        "a strong {dir} breeze cuts across everything, invigorating and insistent",
      ],
      windy: [
        "the {dir} wind is the loudest voice out there right now — everything else defers to it",
        "wind from the {dir} pushes back; walking into it takes something extra",
        "it's genuinely windy — the {dir} gusts are the main event",
        "the {dir} wind is persistent and structural, changing how everything else feels",
      ],
    },

    // Sky as visual/atmospheric context
    skyContext: {
      clear: [
        "under an open, unobstructed sky",
        "beneath a sky that's clean all the way to the horizon",
        "with nothing between you and the full depth of the sky",
        "under clear sky that makes the light direct and unfiltered",
      ],
      "partly-cloudy": [
        "under a partly cloudy sky, light arriving in shifting intervals",
        "with clouds drifting through — the light goes in and out on its own schedule",
        "beneath a sky that can't decide between open and covered",
        "under intermittent cloud that keeps things interesting",
      ],
      "mostly-cloudy": [
        "under a heavy, low ceiling of cloud",
        "beneath cloud cover that softens everything and flattens the shadows",
        "under a mostly grey sky that holds the light in rather than letting it through",
        "with the sky mostly closed off above",
      ],
      overcast: [
        "under a sealed-in overcast that turns the sky into a single flat surface",
        "beneath a full, even grey that diffuses the light into something ambient and still",
        "under complete cloud cover — a grey lid over everything",
        "with the sky locked down in a flat, windowed grey",
      ],
      fog: [
        "in fog that softens every edge and muffles sound and distance",
        "wrapped in coastal fog that turns the world small and immediate",
        "in fog — visibility shortened, the familiar made strange",
        "in a dense grey fog that erases the middle distance entirely",
      ],
      rain: [
        "Rain is falling — steady, unhurried, committed.",
        "A steady rain has moved in and settled.",
        "It's raining in that consistent, no-drama way that just keeps going.",
        "Rain comes down in an even curtain, the kind that means it.",
      ],
      "heavy-rain": [
        "It's raining hard — drums on every surface, soaks through fast.",
        "Heavy rain has taken over. It's the main event right now.",
        "The rain is coming down in earnest, without apology.",
      ],
      snow: [
        "Snow is falling — quiet and deliberate, softening the sound of everything.",
        "It's snowing, and the world is going quieter for it.",
        "Snow drifts down and redraws all the edges.",
      ],
      thunderstorm: [
        "A thunderstorm is working its way through.",
        "The sky has gone bruised and electric — a storm is on.",
        "There's a charged, greenish quality to the light right now.",
      ],
    },

    // Moon vocabulary
    moonContext: [
      "under a {moon} that turns everything silver at the margins",
      "with the {moon} doing most of the lighting out there",
      "the {moon} hangs overhead like a fact you keep forgetting",
      "beneath a {moon} that makes the ordinary look composed",
      "the {moon} is the headline tonight — every roof and branch knows it",
    ],

    // Walking and running feel — what movement actually costs or rewards
    movementFeel: {
      freezing: {
        calm: "Walking, you'd feel the cold find your face within half a block. Running would warm you, but your lungs would work for it.",
        windy: "Walking into that wind would mean squinting, leaning, working. Even short distances have a cost.",
        default: "Movement helps — your body generates heat faster than the air can take it — but stop and you'll know it immediately.",
      },
      cold: {
        calm: "A walk would keep you warm if you kept moving. Stop for more than a minute and the chill finds you again.",
        windy: "Walking is fine if you're dressed for it — the wind does add something you have to account for.",
        default: "Active enough to stay comfortable, still enough to feel the edge if you slow down.",
      },
      cool: {
        calm: "This is clean, easy walking weather. Your lungs welcome it.",
        default: "Good conditions for moving — cool enough to be invigorating, mild enough to be sustainable.",
      },
      mild: {
        calm: "This is walking weather — the kind that makes you take the long way home without deciding to.",
        light: "A walk would feel almost effortless out here, the air doing half the work.",
        default: "You could run comfortably in this. It's the kind of day that rewards it.",
      },
      warm: {
        calm: "A walk is pleasant but the warmth accumulates — you'd want water if you were going far.",
        breezy: "The breeze takes enough edge off the warmth to make movement feel reasonable.",
        default: "Moving in this takes a little more out of you than it looks like it should.",
      },
      hot: {
        calm: "Even a slow walk builds heat faster than the air carries it away. You'd feel it in the back of the throat.",
        breezy: "The wind takes some edge off, but movement in this heat still costs something.",
        default: "This is heat that demands respect — go slow, stay hydrated, take the shade when you find it.",
      },
      scorching: {
        default: "Being outside right now is a commitment. The heat meets you at every step and stays close. Water and shade are not optional.",
      },
    },

    // Season-aware context — what the season makes of the current condition
    seasonalNote: {
      winter: {
        freezing: "This is winter doing what winter does — no ambiguity, no apology.",
        cold: "The cold has the weight of the season behind it. It's not going anywhere soon.",
        cool: "A cool day in winter still carries that low-angled, muted quality — the light stays thin.",
        mild: "A mild winter day arrives like a brief negotiation, the season offering a temporary concession.",
        warm: "Warm for this time of year — the kind of day that confuses the body and delights it anyway.",
      },
      spring: {
        freezing: "A freeze this late in the season feels like a dispute — the calendar says one thing, the thermometer another.",
        cold: "A cold snap against the season's grain, stubbornly winter when everything else is turning.",
        cool: "Classic spring air — not fully committed to warmth, but getting there.",
        mild: "Spring at its most reliable: mild and improving, the air carrying a faint promise of heat to come.",
        warm: "Early warmth, the kind that catches you off guard and makes you forget your jacket.",
        hot: "Unseasonably hot for spring — the season skipping its middle chapter entirely.",
      },
      summer: {
        cool: "Cool for summer — almost out of character, a small break from the pattern.",
        mild: "The summer is being relatively gracious today.",
        warm: "Standard summer warmth, steady and familiar, the season in its typical voice.",
        hot: "Proper summer heat — unambiguous, committed, entirely itself.",
        scorching: "The summer at its most serious. This is the heat that defines the season in memory.",
      },
      autumn: {
        warm: "Warm for autumn — borrowed time before the turn. Worth noting, worth savoring.",
        mild: "A mild autumn day, the season at its most civilized and elegant.",
        cool: "The cool has the weight of the season in it now. This is autumn meaning it.",
        cold: "Autumn cold with teeth — the turn is complete, the next chapter already started.",
        freezing: "A hard frost in autumn — the cold arriving ahead of schedule, unwilling to wait.",
      },
    },

    // Thunderstorm texture (replaces rainTexture when it's actually storming)
    thunderstormTexture: [
      "When a storm moves through like this, temperature becomes almost irrelevant.",
      "The rain here is almost secondary to everything happening above it.",
      "Thunder changes the acoustics of the neighborhood entirely — everything goes wide and electric.",
    ],

    // Rain-specific texture
    rainTexture: {
      cold: [
        "Cold rain is its own thing — damp and bone-finding in a way that dry cold isn't.",
        "Rain in cold air lands heavier than it is. You feel it settling in.",
      ],
      cool: [
        "Cool rain falls clean and deliberate, the kind that smells like the ground waking up.",
        "Rain in this temperature has a particular freshness to it — almost mineral.",
      ],
      mild: [
        "Mild-weather rain is benign enough — you get wet, but it doesn't punish you for it.",
        "Rain at this temperature is more mood than misery.",
      ],
      warm: [
        "Warm rain is strange and tropical — you barely mind getting wet because the air catches you on the other side.",
        "Rain when it's warm feels almost like relief, the air finally doing something with all that moisture.",
      ],
    },

    // Fog-specific texture
    fogTexture: [
      "Fog shortens the world to what's close. Familiar streets become unfamiliar at the edges.",
      "In fog, sound carries differently — voices, steps, a car door — clearer somehow, more deliberate.",
      "The fog has a particular smell to it: cold, green, and coastal.",
      "Visibility is limited but the detail of what's nearby gets sharper by contrast.",
      "Fog turns everything into silhouette past a certain distance.",
    ],

    // Snow-specific texture
    snowTexture: [
      "Snow muffles things — traffic, footsteps, all the usual urban frequencies go soft.",
      "The light in snowfall is flat and even, shadowless, almost kind.",
      "Snow on the ground changes the acoustics of a neighborhood in ways that feel immediately obvious.",
      "Falling snow has the quality of a held breath — things slow, the air goes careful.",
    ],
  };

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
    const moonVisible = isNight && isMoonNotable(moon) && maybe(0.7, rand);
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
    if (skyCondition === "rain" || skyCondition === "heavy-rain") {
      return "You could walk in this if you wanted to — you'd arrive damp, but not broken by it.";
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

  // ---------------------------------------------------------------------------
  // Narrative arc templates
  // ---------------------------------------------------------------------------

  function templateRainLead(ctx, rand) {
    // Opens with rain, blends temp, closes with what movement means
    const timeOpener = pick(vocab.openerByTime[ctx.timeBand], rand);
    const rainPhrase = pickSkyPhrase(ctx.skyCondition, rand);
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
    return `${timeOpener}: the fog has settled in. ${sent(fogDetail)} ${sent(tempPhrase)}`;
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

  function templateWindLead(ctx, rand) {
    // Wind is the main character — direction, sky context, what it means for body
    const windPhrase = pickWindPhrase(ctx.windBand, ctx.windDir, rand);
    const skyPhrase = ctx.hasSkyData
      ? pickSkyPhrase(ctx.skyCondition, rand)
      : null;
    const tempPhrase = pick(vocab.tempBody[ctx.tempBand], rand);
    const movement = pickMovementFeel(ctx.tempBand, ctx.windBand, ctx.skyCondition, rand);
    const parts = [
      skyPhrase
        ? sent(`${cap(windPhrase)}, ${skyPhrase}`)
        : sent(cap(windPhrase)),
      sent(tempPhrase),
    ];
    if (movement && maybe(0.65, rand)) parts.push(sent(movement));
    return parts.join(" ");
  }

  function templateClearNight(ctx, rand) {
    // Moon + temp + night stillness
    const moonPhrase = pick(vocab.moonContext, rand).replace(
      /\{moon\}/g,
      ctx.moon,
    );
    const tempPhrase = pick(vocab.tempBody[ctx.tempBand], rand);
    const windPhrase =
      ctx.windBand && ctx.windBand !== "calm"
        ? pickWindPhrase(ctx.windBand, ctx.windDir, rand)
        : null;
    const movement =
      maybe(0.5, rand)
        ? pickMovementFeel(ctx.tempBand, ctx.windBand, ctx.skyCondition, rand)
        : null;
    const parts = [sent(`${moonPhrase}. Out here, ${tempPhrase}`)];
    if (windPhrase) parts.push(sent(windPhrase));
    if (movement) parts.push(sent(movement));
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
    parts.push(sent(movement || "Staying in motion is the answer."));
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
    const opening = skyPhrase
      ? `${timeOpener}, ${skyPhrase} — ${tempPhrase}.`
      : `${timeOpener}: ${tempPhrase}.`;
    const parts = [opening];
    if (windPhrase) parts.push(sent(windPhrase));
    if (humidPhrase) parts.push(sent(humidPhrase));
    if (movement) parts.push(sent(movement));
    if (seasonNote && maybe(0.5, rand)) parts.push(sent(seasonNote));
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
      ctx.windBand && ctx.windBand !== "calm" && ctx.windBand
        ? pickWindPhrase(ctx.windBand, ctx.windDir, rand)
        : null;
    const seasonNote = pickSeasonalNote(ctx.season, ctx.tempBand, rand);
    const movement =
      maybe(0.5, rand)
        ? pickMovementFeel(ctx.tempBand, ctx.windBand, ctx.skyCondition, rand)
        : null;
    const opening = skyPhrase
      ? `${timeOpener}, ${skyPhrase} — ${tempPhrase}.`
      : `${timeOpener}: ${tempPhrase}.`;
    const parts = [opening];
    if (windPhrase) parts.push(sent(windPhrase));
    parts.push(sent(humidPhrase));
    if (movement) parts.push(sent(movement));
    if (seasonNote) parts.push(sent(seasonNote));
    return parts.join(" ");
  }

  // ---------------------------------------------------------------------------
  // Template selector
  // ---------------------------------------------------------------------------

  function selectTemplate(ctx) {
    if (ctx.isSnowing) return templateSnowScene;
    if (ctx.isFoggy) return templateFogScene;
    if (ctx.isRaining || ctx.precipProb >= 50) return templateRainLead;
    if (ctx.isDramaticallyWindy) return templateWindLead;
    if (
      ctx.moonVisible &&
      (ctx.skyCondition === "clear" || ctx.skyCondition === null)
    ) {
      return templateClearNight;
    }
    if (ctx.tempBand === "freezing") return templateExtremeCold;
    if (ctx.tempBand === "scorching" || ctx.tempBand === "hot")
      return templateExtremeHeat;
    if (ctx.isPleasant) return templatePleasantWalk;
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
    const template = selectTemplate(ctx);
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
    return pickWithoutRecent(dayKey, function () {
      return createPhrase(tempC, humidity, now, options);
    });
  }

  global.WeatherNarrative = { generate };
})(window);
