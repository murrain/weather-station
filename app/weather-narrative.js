(function (global) {
  "use strict";

  const RECENT_LIMIT = 12;
  const recentByDay = {};
  let generationCounter = 0;

  const DAILY_THEMES = [
    { name: "harbor", motif: ["salt light", "rope creak", "quiet tide"] },
    { name: "orchard", motif: ["leaf shade", "fruit skin", "dusty path"] },
    { name: "desert", motif: ["stone heat", "long horizon", "dry wind"] },
    { name: "alpine", motif: ["pine air", "ridge shadow", "thin light"] },
    { name: "prairie", motif: ["open field", "grass hush", "broad sky"] },
    {
      name: "rainstreet",
      motif: ["wet pavement", "window glow", "drip rhythm"],
    },
    { name: "woodsmoke", motif: ["cedar smoke", "ember red", "night porch"] },
    { name: "coastline", motif: ["fog edge", "cold surf", "gull track"] },
    { name: "riverbend", motif: ["slow current", "reed line", "bank mud"] },
    {
      name: "cityglass",
      motif: ["neon reflection", "train hum", "late corner"],
    },
    { name: "meadow", motif: ["tall clover", "soft pollen", "bee arc"] },
    {
      name: "winteryard",
      motif: ["frost rail", "bare branch", "quiet gutter"],
    },
  ];

  const vocab = {
    openerByTime: {
      "late-night": [
        "Late night leans close",
        "Past midnight, the world exhales",
        "In the small hours, silence blooms",
        "After the last porch light blinks out",
        "When streets go thin and secret",
      ],
      dawn: [
        "At first light",
        "In early dawn's pale gold",
        "As dawn lifts its bright shoulders",
        "At the pearl edge of morning",
        "Before daylight fully names the day",
      ],
      morning: [
        "This morning",
        "Through morning's clear throat",
        "Morning air arrives singing",
        "In clear, unhurried light",
        "By breakfast hour, the sky is awake",
      ],
      afternoon: [
        "This afternoon",
        "In the honey of afternoon light",
        "By midday's bright insistence",
        "Across the warm shoulder of day",
        "Under a high and brazen sun",
      ],
      evening: [
        "This evening",
        "At dusk, when colors loosen",
        "As evening gathers its velvet",
        "At blue-hour's hush",
        "Toward nightfall's open curtain",
      ],
      night: [
        "Tonight",
        "After dark, the air turns lyrical",
        "In the night air, every sound glows",
        "Once the sky deepens to ink",
        "Beneath streetlamp halos and moonlight",
      ],
    },
    moonOpeners: [
      "under a {moon}",
      "beneath the {moon}",
      "with a {moon} overhead",
      "while the {moon} hangs low",
      "as the {moon} drifts above",
    ],
    tempTexture: {
      freezing: [
        "freezing and bright as glass",
        "frost-edged and feral",
        "bitter, still, and silver",
        "hard-cold with a clean bite",
        "winter-sharp and glittering",
      ],
      cold: [
        "cold and clean",
        "brisk with a quick pulse",
        "coat-button weather",
        "chill-leaning and alert",
        "cold with a playful bite",
      ],
      cool: [
        "cool and steady",
        "crisp as a fresh page",
        "cool-leaning and lucid",
        "lightly chilled, lightly wild",
        "cool with a silk edge",
      ],
      mild: [
        "mild and easy",
        "gentle and generous",
        "softly balanced",
        "temperate as a kind thought",
        "easygoing and open-hearted",
      ],
      warm: [
        "warm and open",
        "sun-softened and radiant",
        "warm-leaning and golden",
        "comfortably warm, almost glowing",
        "warm with slow dancing momentum",
      ],
      hot: [
        "hot and persistent",
        "summer-heavy and heady",
        "heat-forward and restless",
        "sun-weighted and electric",
        "hot with a bright shimmer",
      ],
      scorching: [
        "scorching and untamed",
        "blazing with fierce intent",
        "hard-heat and thunderous light",
        "near-searing and relentless",
        "sun-hammered and mythic",
      ],
    },
    humidityTexture: {
      dry: [
        "dry air",
        "low, thirsty moisture",
        "parched and papery air",
        "thin humidity",
        "quick-evaporating breath",
      ],
      comfortable: [
        "comfortable moisture",
        "easy humidity",
        "a light and friendly dampness",
        "lightly humid air",
        "balanced-leaning moisture",
      ],
      balanced: [
        "balanced humidity",
        "middle-range moisture",
        "steady, breathing moisture",
        "calm humidity",
        "well-mannered wetness",
      ],
      humid: [
        "humid air",
        "noticeable moisture",
        "thickening humidity",
        "moisture-rich air",
        "air with velvet weight",
      ],
      saturated: [
        "very humid air",
        "saturated moisture",
        "steam-heavy humidity",
        "dense wet air",
        "almost-rain-born moisture",
      ],
    },
    comfortByCombo: {
      muggy: [
        "Warmth and moisture are dancing close; the air feels lush and heavy.",
        "The day wraps itself around you like warm velvet.",
        "Shade will feel like a small mercy and a gift.",
        "Every movement meets a soft, tropical resistance.",
        "The atmosphere is thick with green-house energy.",
      ],
      dampChill: [
        "Cold and moisture braid together into a blue-edged chill.",
        "The air lands damp on skin and settles in the bones.",
        "Window glass and railings will hold the cold like memory.",
        "Layers will feel kinder than the numbers suggest.",
        "The weather carries a quiet, melancholic bite.",
      ],
      dryHeat: [
        "The dry heat is clean-edged and fierce.",
        "Sunlight strikes like a bright bell on stone.",
        "Shade will feel like stepping into a new chapter.",
        "Hydration matters; the air is quietly demanding.",
        "Surfaces in direct sun will glow with stored fire.",
      ],
      steady: [
        "The weather is balanced enough to wander in.",
        "Conditions hold a calm, generous center.",
        "Nothing is shouting; everything is humming.",
        "This is a breathable, companionable stretch of day.",
        "The air feels steady, like a hand at your back.",
      ],
    },
    closers: [
      "The day feels alive, as if the sky has a pulse.",
      "It is weather that invites you to look up and keep looking.",
      "Even ordinary corners feel newly enchanted.",
      "The atmosphere carries both mischief and tenderness.",
      "The whole hour feels handwritten.",
      "The world seems to be speaking in bright, wind-bent metaphors.",
      "You can feel the moment widening while you stand in it.",
      "It leaves a luminous fingerprint on memory.",
      "Somewhere between whimsy and wildness, this weather sings.",
      "The air arrives like a story with its sleeves rolled up.",
    ],
    zeitgeistByTime: {
      "late-night": [
        "The hour turns intimate, unrushed, and a little feral.",
        "Moonlight makes everything feel quietly conspiratorial.",
        "It feels like a secret shared with the dark.",
      ],
      dawn: [
        "Everything feels like it is beginning again, bright with possibility.",
        "The first pulse of morning feels brave and clean.",
        "The air carries that unmistakable sense of becoming.",
      ],
      morning: [
        "The mood is clear-eyed and full of momentum.",
        "The day feels newly minted and eager.",
        "Everything in the air points forward.",
      ],
      afternoon: [
        "The afternoon arrives bold, sunlit, and unafraid.",
        "The hour carries confident heat and open sky.",
        "The day stands tall and vivid.",
      ],
      evening: [
        "It feels cinematic: tender light, long shadows, open heart.",
        "Evening moves like a quiet encore.",
        "The hour glows with reflective warmth.",
      ],
      night: [
        "The night feels deep and luminous, equal parts hush and wonder.",
        "Night turns the ordinary electric.",
        "The hour is dreamy, daring, and alive.",
      ],
    },
    stepOutsideByTime: {
      "late-night": [
        "The moment you step outside, the night wraps around you like ink and velvet.",
        "Step outside now and the dark feels close, intimate, and electric.",
        "Outside, the late hour greets you with a hush that almost glows.",
      ],
      dawn: [
        "The moment you step outside, dawn opens like a bright secret.",
        "Step outside now and the morning edge feels fresh and full of promise.",
        "Outside, first light touches everything with a quiet spark.",
      ],
      morning: [
        "The moment you step outside, morning meets you with a clear pulse.",
        "Step outside now and the day feels newly minted around your shoulders.",
        "Outside, morning air arrives lively and bright.",
      ],
      afternoon: [
        "The moment you step outside, afternoon comes in bold and sunlit.",
        "Step outside now and the day feels wide, warm, and unapologetic.",
        "Outside, the light is full-bodied and alive on every surface.",
      ],
      evening: [
        "The moment you step outside, evening softens the edges of everything.",
        "Step outside now and dusk feels cinematic, tender, and open-hearted.",
        "Outside, the blue-hour air carries a slow, glowing hush.",
      ],
      night: [
        "The moment you step outside, night feels deep, luminous, and awake.",
        "Step outside now and the dark hums with quiet wonder.",
        "Outside, night air turns ordinary streets into small constellations.",
      ],
    },
    bodyFeelByHumidity: {
      dry: [
        "On skin, the air feels light and thirsty, almost papery at the edges.",
        "You feel dryness first: clean, quick, and a little austere.",
        "The air brushes by with a dry, whisper-thin touch.",
      ],
      comfortable: [
        "On skin, the air feels easy, breathable, and kind.",
        "The humidity sits in a gentle middle, soft on the lungs.",
        "It feels balanced on your face and hands, neither clinging nor fleeing.",
      ],
      balanced: [
        "On skin, the moisture feels calm and well-tempered.",
        "The air has a steady, companionable texture.",
        "Humidity settles into a balanced rhythm against your body.",
      ],
      humid: [
        "On skin, moisture lingers just enough to feel lush.",
        "You can feel the humidity gather and hold, velvet-like.",
        "The air clings gently, warm and alive.",
      ],
      saturated: [
        "On skin, the air lands damp and full, almost rain-ready.",
        "Humidity wraps around you in a dense, tropical veil.",
        "The moisture is palpable, rich and close as breath.",
      ],
    },
    highlightByType: {
      moon: [
        "The {moon} steals the scene and turns everything silver at the edges.",
        "Tonight the {moon} is the headline, and every rooftop seems to know it.",
        "The {moon} hangs like a bright punctuation mark over the whole block.",
      ],
      walking: [
        "It feels like perfect walking weather, the kind that makes you take the long way home.",
        "This is strolling weather: open-chested, easy, and quietly joyful.",
        "You could wander for an hour in this and call it medicine.",
      ],
      heat: [
        "The heat is the loudest voice in the room, bright and insistent.",
        "Sun and air are working in tandem, and you feel it immediately.",
        "Warmth takes command the moment you step into it.",
      ],
      chill: [
        "The chill arrives first, quick and articulate against your skin.",
        "Cold writes itself across your hands before anything else.",
        "The air carries a crisp bite that keeps you fully awake.",
      ],
      humidity: [
        "Moisture is the main character right now, soft and inescapably present.",
        "The air carries a damp weight that lingers on skin and fabric.",
        "Humidity rounds every edge and makes the atmosphere feel close.",
      ],
      open: [
        "What stands out is the balance: nothing shouting, everything alive.",
        "The moment feels harmonized, as if light and air agreed on a key.",
        "It has that rare composure where weather feels both gentle and awake.",
      ],
    },
  };

  function pad2(num) {
    return String(num).padStart(2, "0");
  }

  function getDayKey(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

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

  function pickRandom(items, rand) {
    const rng = rand || Math.random;
    return items[Math.floor(rng() * items.length)];
  }

  function weightedPick(options, rand) {
    const rng = rand || Math.random;
    const total = options.reduce((sum, opt) => sum + opt.weight, 0);
    let roll = rng() * total;
    for (const opt of options) {
      roll -= opt.weight;
      if (roll <= 0) return opt.value;
    }
    return options[options.length - 1].value;
  }

  function rememberPhrase(dayKey, phrase) {
    if (!recentByDay[dayKey]) recentByDay[dayKey] = [];
    recentByDay[dayKey].push(phrase);
    if (recentByDay[dayKey].length > RECENT_LIMIT) {
      recentByDay[dayKey].shift();
    }
  }

  function pickWithoutRecent(dayKey, generator, attempts) {
    const maxAttempts = attempts || 10;
    const recent = recentByDay[dayKey] || [];
    let candidate = generator();
    for (let i = 0; i < maxAttempts; i++) {
      if (!recent.includes(candidate)) break;
      candidate = generator();
    }
    rememberPhrase(dayKey, candidate);
    return candidate;
  }

  function getTimeBand(hours) {
    if (hours < 5) return "late-night";
    if (hours < 8) return "dawn";
    if (hours < 12) return "morning";
    if (hours < 17) return "afternoon";
    if (hours < 21) return "evening";
    return "night";
  }

  function getMoonPhaseName(date) {
    const phaseLengthDays = 29.53058867;
    const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14, 0);
    const daysSinceKnown = (date.getTime() - knownNewMoon) / 86400000;
    const cyclePos =
      ((daysSinceKnown % phaseLengthDays) + phaseLengthDays) % phaseLengthDays;
    const phase = cyclePos / phaseLengthDays;

    if (phase < 0.03 || phase >= 0.97) return "new moon";
    if (phase < 0.22) return "waxing crescent";
    if (phase < 0.28) return "first quarter";
    if (phase < 0.47) return "waxing gibbous";
    if (phase < 0.53) return "full moon";
    if (phase < 0.72) return "waning gibbous";
    if (phase < 0.78) return "last quarter";
    return "waning crescent";
  }

  function getTemperatureBand(tempC) {
    if (tempC <= 0) return "freezing";
    if (tempC <= 7) return "cold";
    if (tempC <= 14) return "cool";
    if (tempC <= 22) return "mild";
    if (tempC <= 28) return "warm";
    if (tempC <= 33) return "hot";
    return "scorching";
  }

  function getHumidityBand(humidity) {
    if (humidity < 30) return "dry";
    if (humidity < 45) return "comfortable";
    if (humidity < 65) return "balanced";
    if (humidity < 80) return "humid";
    return "saturated";
  }

  function selectComfortLine(tempC, humidity, rand) {
    if (tempC > 28 && humidity > 70) {
      return pickRandom(vocab.comfortByCombo.muggy, rand);
    }
    if (tempC < 8 && humidity > 70) {
      return pickRandom(vocab.comfortByCombo.dampChill, rand);
    }
    if (tempC > 30 && humidity < 35) {
      return pickRandom(vocab.comfortByCombo.dryHeat, rand);
    }
    return pickRandom(vocab.comfortByCombo.steady, rand);
  }

  function fillTemplate(template, values) {
    return template.replace(/\{([a-zA-Z0-9_]+)\}/g, function (_m, key) {
      return Object.prototype.hasOwnProperty.call(values, key)
        ? values[key]
        : "";
    });
  }

  function getDailyTheme(dayKey) {
    const index = hashString(dayKey) % DAILY_THEMES.length;
    return DAILY_THEMES[index];
  }

  function createSeed(dayKey, tempC, humidity) {
    generationCounter += 1;
    const signature = `${dayKey}|${Math.round(tempC * 10)}|${Math.round(humidity)}|${generationCounter}`;
    return hashString(signature);
  }

  function chooseHighlightType(context, rand) {
    if (context.moonShowpiece && rand() > 0.2) return "moon";
    if (context.walkingPerfect) return "walking";
    if (context.tempBand === "scorching" || context.tempBand === "hot")
      return "heat";
    if (
      context.tempBand === "freezing" ||
      context.tempBand === "cold" ||
      (context.tempBand === "cool" && context.humidityBand === "saturated")
    ) {
      return "chill";
    }
    if (
      context.humidityBand === "humid" ||
      context.humidityBand === "saturated" ||
      context.humidityBand === "dry"
    ) {
      return "humidity";
    }
    return "open";
  }

  function createPhrase(tempC, humidity, date) {
    const dayKey = getDayKey(date);
    const theme = getDailyTheme(dayKey);
    const rand = mulberry32(createSeed(dayKey, tempC, humidity));

    const timeBand = getTimeBand(date.getHours());
    const moon = getMoonPhaseName(date);
    const tempBand = getTemperatureBand(tempC);
    const humidityBand = getHumidityBand(humidity);

    const opener = weightedPick(
      vocab.openerByTime[timeBand].map(function (value, idx) {
        return { value, weight: idx === 0 ? 3 : 2 };
      }),
      rand,
    );
    const moonOpener = fillTemplate(pickRandom(vocab.moonOpeners, rand), {
      moon,
    });
    const tempPhrase = pickRandom(vocab.tempTexture[tempBand], rand);
    const humidityPhrase = pickRandom(
      vocab.humidityTexture[humidityBand],
      rand,
    );
    const comfort = selectComfortLine(tempC, humidity, rand);
    const closer = pickRandom(vocab.closers, rand);
    const motifLine = `Today's voice carries ${pickRandom(theme.motif, rand)}.`;
    const zeitgeist = pickRandom(vocab.zeitgeistByTime[timeBand], rand);
    const stepOutside = fillTemplate(
      pickRandom(vocab.stepOutsideByTime[timeBand], rand),
      { opener, moonOpener },
    );
    const moonNotable =
      moon === "full moon" ||
      moon === "new moon" ||
      moon === "first quarter" ||
      moon === "last quarter";
    const moonRelevantTime =
      timeBand === "late-night" ||
      timeBand === "night" ||
      timeBand === "evening" ||
      timeBand === "dawn";
    const includeMoon = moonRelevantTime && (moonNotable || rand() > 0.4);
    const skyPhrase = includeMoon ? moonOpener : "under an open sky";
    const weatherLine = `${opener} ${skyPhrase}, the air feels ${tempPhrase}.`;
    const textureLine = `Around you, ${humidityPhrase} meets ${tempPhrase} in the same breath.`;
    const bodyFeel = pickRandom(vocab.bodyFeelByHumidity[humidityBand], rand);
    const walkingPerfect =
      (timeBand === "morning" ||
        timeBand === "afternoon" ||
        timeBand === "evening") &&
      (tempBand === "mild" || tempBand === "warm") &&
      (humidityBand === "comfortable" || humidityBand === "balanced");
    const moonShowpiece =
      includeMoon &&
      (moon === "full moon" ||
        moon === "first quarter" ||
        moon === "last quarter");
    const highlightType = chooseHighlightType(
      {
        moonShowpiece,
        walkingPerfect,
        tempBand,
        humidityBand,
      },
      rand,
    );
    const highlightLine = fillTemplate(
      pickRandom(vocab.highlightByType[highlightType], rand),
      { moon },
    );

    const sentencePool = [
      weatherLine,
      textureLine,
      bodyFeel,
      comfort,
      zeitgeist,
      motifLine,
      closer,
    ];
    const targetCount = rand() > 0.4 ? 4 : 3;
    const sentences = [stepOutside, highlightLine];

    while (sentences.length < targetCount && sentencePool.length > 0) {
      const next = pickRandom(sentencePool, rand);
      const idx = sentencePool.indexOf(next);
      if (idx >= 0) {
        sentencePool.splice(idx, 1);
      }
      if (!sentences.includes(next)) {
        sentences.push(next);
      }
    }

    return sentences.join(" ");
  }

  function generate(tempC, humidity, date) {
    if (tempC === null || humidity === null) {
      return "Waiting for enough sensor data to describe conditions.";
    }

    const now = date || new Date();
    const dayKey = getDayKey(now);

    return pickWithoutRecent(dayKey, function () {
      return createPhrase(tempC, humidity, now);
    });
  }

  global.WeatherNarrative = {
    generate,
  };
})(window);
