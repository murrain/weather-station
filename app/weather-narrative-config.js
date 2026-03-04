(function (global) {
  "use strict";

  global.WeatherNarrativeConfig = {

    // -------------------------------------------------------------------------
    // Salience rules — ordered highest to lowest.
    // The engine picks the FIRST matching condition as the narrative lead.
    // Edit order here to change what "wins" the opening sentence.
    //
    // 'score' is documentation only — it has no runtime effect.
    //   The engine iterates in order and returns on the first match.
    // 'when' must match a key in the engine's CONDITIONS map.
    // 'template' must match a key in the engine's TEMPLATE_FNS map.
    // -------------------------------------------------------------------------
    salience: [
      { when: "thunderstorm", score: 100, template: "rain"        },
      { when: "snow",         score: 95,  template: "snow"        },
      { when: "fog",          score: 90,  template: "fog"         },
      { when: "moonLead",     score: 85,  template: "clearNight"  },
      { when: "heavyRain",    score: 75,  template: "rain"        },
      { when: "rain",         score: 65,  template: "rain"        },
      { when: "windy",        score: 55,  template: "wind"        },
      { when: "freezing",     score: 50,  template: "extremeCold" },
      { when: "hot",          score: 45,  template: "extremeHeat" },
      { when: "pleasant",     score: 35,  template: "pleasant"    },
      { when: "default",      score: 20,  template: "seasonal"    },
    ],

    // -------------------------------------------------------------------------
    // Vocabulary — all sentence pools.
    // Edit, add, or remove phrases here without touching the engine.
    // -------------------------------------------------------------------------
    vocab: {

      // Time-of-day scene openers — equal weight, varied structure
      openerByTime: {
        "late-night": [
          "Late night leans in close",
          "Past midnight, the world exhales",
          "In the small hours, everything goes quiet and strange",
          "After the last porch light blinks out",
          "The night has settled into its deepest register",
          "At this hour the streets belong to no one in particular",
          "Three a.m. is its own specific country with its own particular weather",
          "The neighborhood has stopped performing and gone to bed, mostly",
          "Something about this hour makes the ordinary feel confessional",
          "At this depth of the night, the air holds what the day left behind",
        ],
        dawn: [
          "At first light",
          "In early dawn's pale gold",
          "As dawn lifts its shoulders",
          "Before daylight fully names the day",
          "At the grey-blue edge of morning",
          "The sky is barely deciding what color to be",
          "The birds have formed opinions about this hour and are sharing them",
          "Dawn arrives like someone who stayed up all night — uncertain but present",
          "The world is beginning to remember what it is",
          "The light is not fully committed yet, which is fine",
        ],
        morning: [
          "This morning",
          "Through morning's clear throat",
          "In the clean light of morning",
          "By this hour the day is awake and moving",
          "Morning has settled in with a steady hand",
          "The morning air has its own particular authority",
          "The morning has its facts ready and is presenting them",
          "Before the afternoon gets hold of it",
          "The day has just introduced itself",
          "Everything is conducting itself with morning's particular seriousness",
        ],
        afternoon: [
          "This afternoon",
          "In the full weight of afternoon",
          "The day stands at its tallest point",
          "Under a high and confident sun",
          "Afternoon has taken hold and isn't letting go",
          "The day is in full voice now",
          "The afternoon has been at this for hours and has fully committed",
          "Everything is at its most itself right now — no more promises, just delivery",
          "The afternoon neither apologizes nor explains",
          "The sun has settled into its position and isn't moving for anyone",
        ],
        evening: [
          "This evening",
          "As evening gathers itself",
          "At the blue-hour hush",
          "Toward nightfall, when colors soften",
          "The light is doing that thing it does at dusk",
          "Evening arrives like a long exhale",
          "The day is becoming something else at the edges",
          "Evening is doing its slow work on the light",
          "Something in the air has decided to shift registers",
          "The light is doing the thing it does when it's about to leave",
        ],
        night: [
          "Tonight",
          "After dark, the air shifts register",
          "Once the sky deepens to ink",
          "In the night air",
          "The night has its own kind of brightness",
          "At this depth of evening",
          "The night has made itself comfortable",
          "The neighborhood is down to its essential frequencies",
          "Stars and satellites are doing their different work up there",
          "Out here after dark, the air belongs to different things than it did at noon",
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
          "the air has stopped cooperating and is now actively disagreeing",
          "your glasses fog the moment you step out, which is the air making a point",
          "the cold has opinions and shares them immediately with every exposed surface",
          "breath comes out in quick white clouds and the cold feels like a decision you made",
        ],
        cold: [
          "there's a brisk, clarifying chill that keeps you fully present",
          "the cold is enough to remind you it's there without being cruel about it",
          "your face knows immediately; your hands will follow",
          "it's the kind of cold that rewards movement — stand still and you feel it",
          "the air arrives direct and cool-edged against exposed skin",
          "not hostile, just honest in a way that warm weather never quite manages",
          "the kind of cold that makes you briefly reconsider your outfit choices",
          "brisk doesn't quite cover it — this has direction and intent",
          "the cold is emphatic but not cruel — it has standards",
        ],
        cool: [
          "the air is crisp and lightly chilled, easy to breathe",
          "there's a cool, clean freshness to every inhale",
          "the temperature is a little below comfortable — pleasantly so",
          "it's cool enough for a jacket but not cold enough to resent it",
          "the air has a silk-light edge, neither demanding nor indifferent",
          "the air has some opinions but isn't insisting on them",
          "cool in the way that late-season air is cool — carrying the memory of something warmer",
          "a temperature you could live in permanently without drama",
          "something about it says: good decision, going outside",
        ],
        mild: [
          "the temperature is easy — neither asking too much nor giving too little",
          "it's that rare balance where the air just agrees with your skin",
          "it's mild and quietly generous, the kind of weather that goes unnoticed in the best way",
          "the air is soft, open-handed, unhurried",
          "the temperature is what you'd design if you could — just comfortable",
          "the air has nothing to prove and everything to recommend",
          "this is the weather that makes you feel like you've won something small but real",
          "mild enough that the temperature is background — present but not competing for attention",
          "the air makes no demands and no promises, which is sometimes exactly right",
        ],
        warm: [
          "warmth settles into exposed skin within seconds of stepping out",
          "the air is genuinely warm, not just the absence of cold",
          "the sun's work is evident — surfaces hold heat and give it back",
          "it's warm and open, the kind of warmth that makes you want to stay outside longer than planned",
          "it's warm in a way that loosens the shoulders, slows the pace",
          "warmth that makes you want to do something with your afternoon you hadn't planned",
          "the heat is generous in the way only excess can be",
          "even in the shade it's warm — the heat is ambient, not just a function of direct sun",
          "warm in a way that makes everything feel slightly more possible than it did inside",
        ],
        hot: [
          "the heat is the first thing — bold, immediate, hard to ignore",
          "you feel it on the top of the head first, then everywhere else",
          "the air is thick with heat; even a slow walk builds it faster than it clears",
          "it's hot in a way that makes shade feel like a small, urgent mercy",
          "the heat has a weight to it, pressing gently on every exposed inch",
          "the kind of hot that makes shade feel like a small, urgent miracle",
          "the air shimmers over pavement and the horizon develops a slight unreality",
          "your tolerance for direct light goes down fast in this; the body starts negotiating",
          "the heat is immediate and total — it doesn't build so much as announce itself at once",
        ],
        scorching: [
          "the heat is aggressive — it meets you at the door and doesn't let up",
          "within a minute, the sun is working on you in a way you can feel",
          "the air shimmers slightly; surfaces in direct light are untouchable",
          "this is serious heat — the kind that demands water and shade and pacing",
          "everything outside holds stored fire right now; the world is a slow oven",
          "the sun is working at full capacity and there is no arguing with it",
          "surfaces in direct light are past warm — they're an argument for staying inside",
          "the pavement has opinions now",
          "this is the heat that defines a day in retrospect — you'll remember this specific afternoon",
        ],
      },

      // Humidity as sensation — paired with temp context
      humidityBody: {
        dry: [
          "the air is dry enough to feel it on the lips after a minute",
          "there's a clean, papery dryness to the air — your throat notices it first",
          "low moisture means the air has a light, quick quality",
          "dryness gives the air a crispness that reads almost as altitude",
          "the air is doing that thing where it takes more than it gives",
          "your lips will have something to say about this in a few minutes",
          "a papery quality to the air — the kind that makes the desert feel logical",
        ],
        comfortable: [
          "the moisture level is just right — the air breathes without any resistance",
          "humidity is low enough to be kind, high enough to not be arid",
          "the air feels balanced, neither clinging nor fleeing",
          "the humidity is having a good day, which means you are too",
          "moisture so right you forget it's a measurement at all",
        ],
        balanced: [
          "the air carries a steady, neutral moisture — neither wet nor dry",
          "humidity settles into a calm middle register that the body accepts easily",
          "the moisture content is just background, which is exactly what you want",
          "humidity so correct it disappears as a concept",
          "balanced in a way that lets everything else be the story",
        ],
        humid: [
          "the humidity is noticeable — the air has a soft, velvet texture",
          "moisture clings a little, slows evaporation, makes the heat feel closer",
          "you can feel the dampness gather on skin after a few minutes outside",
          "the air is making its presence known without quite apologizing for it",
          "the air is thick enough to wear — you carry it around with you",
          "humid in a way that makes the heat feel like it's gaining interest",
        ],
        saturated: [
          "the air is close to saturation — dense and warm against the face",
          "humidity wraps around you like a second layer you didn't ask for",
          "the moisture is palpable; you're breathing as much water vapor as air",
          "the air is sweating, and by extension so are you",
          "the air and the water have merged into something you walk through",
          "you're breathing as much water as air and the cooling mechanism has strong opinions about this",
        ],
      },

      // Wind as narrative element — {dir} is replaced with cardinal name
      windBody: {
        calm: [
          "the air is perfectly still — not a leaf stirring, not a flag moving",
          "there's no wind at all; the air sits close and undisturbed",
          "in the absence of wind, every sound carries farther than usual",
          "the stillness has a quality of held breath",
          "the air is taking a position on stillness and maintaining it",
          "nothing moving anywhere — the whole neighborhood is holding something back",
          "still enough that you could hear something a block away that you normally couldn't",
        ],
        light: [
          "a light {dir} breeze moves through, barely enough to notice but welcome",
          "there's the gentlest wind from the {dir} — more suggestion than presence",
          "a faint {dir} drift keeps the air from going stagnant",
          "the lightest {dir} breeze lifts just enough to feel on a warm cheek",
          "a {dir} breath of wind — barely enough to count but doing its part",
          "the {dir} offers the suggestion of a breeze, which is almost as good",
          "the faintest {dir} movement, enough to stir the tops of grass and nothing else",
        ],
        moderate: [
          "a steady {dir} wind keeps the air in easy motion",
          "the {dir} wind is enough to ruffle hair and collar, nothing more",
          "there's a consistent {dir} breeze that makes the temperature feel a few degrees kinder",
          "a moderate {dir} wind reads through the trees in a pleasant, ongoing conversation",
          "a firm {dir} wind does the courtesy of being consistent",
          "the {dir} wind is present and reliable, moving through without making demands",
          "a working {dir} breeze — nothing dramatic, but you notice it and you're glad it's there",
        ],
        breezy: [
          "a brisk {dir} wind makes itself known immediately — hair, jacket, eyes",
          "the {dir} wind is lively; you'd feel it against your face within a block",
          "it's breezy from the {dir} in a way that demands something fastened",
          "a strong {dir} breeze cuts across everything, invigorating and insistent",
          "the {dir} wind has opinions about where things should be, and is acting on them",
          "breezy enough from the {dir} that your hair has given up on arrangements",
          "the {dir} wind is insistent — it has a position on things and won't be negotiated with",
        ],
        windy: [
          "the {dir} wind is the loudest voice out there right now — everything else defers to it",
          "wind from the {dir} pushes back; walking into it takes something extra",
          "it's genuinely windy — the {dir} gusts are the main event",
          "the {dir} wind is persistent and structural, changing how everything else feels",
          "the {dir} wind is the organizing principle of everything outside right now",
          "everything that can move is moving, compliments of the {dir}",
          "wind from the {dir} has arrived and is taking up a significant amount of space",
        ],
      },

      // Sky as visual/atmospheric context
      skyContext: {
        clear: [
          "under an open, unobstructed sky",
          "beneath a sky that's clean all the way to the horizon",
          "with nothing between you and the full depth of the sky",
          "under clear sky that makes the light direct and unfiltered",
          "the sky is doing nothing but being itself, which turns out to be enough",
          "overhead: just sky, all the way up, nothing qualifying it",
          "with a clarity overhead that makes distances feel honest",
        ],
        "partly-cloudy": [
          "under a partly cloudy sky, light arriving in shifting intervals",
          "with clouds drifting through — the light goes in and out on its own schedule",
          "beneath a sky that can't decide between open and covered",
          "under intermittent cloud that keeps things interesting",
          "clouds drifting through like they have somewhere else to be eventually",
          "the sky can't fully commit today and the light keeps changing its mind accordingly",
          "beneath a sky that seems genuinely undecided about what kind of day it wants to have",
        ],
        "mostly-cloudy": [
          "under a heavy, low ceiling of cloud",
          "beneath cloud cover that softens everything and flattens the shadows",
          "under a mostly grey sky that holds the light in rather than letting it through",
          "with the sky mostly closed off above",
          "the sun is working behind the clouds but billing it as a mystery",
          "the grey is thorough but not final — there's still negotiation happening up there",
          "beneath cloud cover that has flattened all the shadows and softened everything it found",
        ],
        overcast: [
          "under a sealed-in overcast that turns the sky into a single flat surface",
          "beneath a full, even grey that diffuses the light into something ambient and still",
          "under complete cloud cover — a grey lid over everything",
          "with the sky locked down in a flat, windowed grey",
          "the sky has called it and the light agrees — it's just grey out, evenly",
          "beneath overcast so complete the light has no source; it arrives from everywhere at once",
          "the cloud cover has made a decision and the shadows have disappeared accordingly",
        ],
        rain: [
          "Rain is falling — steady, unhurried, committed.",
          "A steady rain has moved in and settled.",
          "It's raining in that consistent, no-drama way that just keeps going.",
          "Rain comes down in an even curtain, the kind that means it.",
          "The rain has moved in and unpacked.",
          "Rain, committed and unhurried, carrying on out there.",
          "It's raining with the quiet confidence of something that has its reasons.",
        ],
        "heavy-rain": [
          "It's raining hard — drums on every surface, soaks through fast.",
          "Heavy rain has taken over. It's the main event right now.",
          "The rain is coming down in earnest, without apology.",
          "The rain has made a statement. The statement is: outside is not the place.",
          "Heavy rain — the kind that wins the argument before you've finished making it.",
        ],
        snow: [
          "Snow is falling — quiet and deliberate, softening the sound of everything.",
          "It's snowing, and the world is going quieter for it.",
          "Snow drifts down and redraws all the edges.",
          "Snow is falling with the quiet confidence of something that knows it'll win.",
          "The snow is covering its tracks — and everything else's.",
          "It's snowing, which is the sky's most thorough editorial mode.",
        ],
        thunderstorm: [
          "A thunderstorm is working its way through.",
          "The sky has gone bruised and electric — a storm is on.",
          "There's a charged, greenish quality to the light right now.",
          "Lightning is doing math overhead and thunder is showing its work.",
          "The sky has upgraded to its most serious mode.",
          "A thunderstorm has arrived with a full complement of opinions.",
        ],
      },

      // Moon vocabulary — used when moon is a supporting character
      moonContext: [
        "under a {moon} that turns everything silver at the margins",
        "with the {moon} doing most of the lighting out there",
        "the {moon} hangs overhead like a fact you keep forgetting",
        "beneath a {moon} that makes the ordinary look composed",
        "the {moon} is the headline tonight — every roof and branch knows it",
        "a {moon} that seems surprised to find itself so visible",
        "the {moon} doing its usual excellent work, mostly unobserved",
        "with the {moon} tracking overhead like it has a point to make",
        "the {moon} has claimed most of the sky and is not sharing",
        "a {moon} overhead that makes the entire neighborhood look like it's being photographed",
      ],

      // Full moon lead openers — used when full moon IS the first sentence
      moonLead: {
        full: [
          "A full moon has converted the yard to silver",
          "The full moon is the headline tonight — every roof and branch catches it",
          "A full moon rides overhead, flooding everything in cold, even light",
          "Under a full moon this bright, every surface has a hard shadow",
          "The full moon turns the familiar strange — everything is lit from the wrong angle",
          "A full moon hangs above like something that means it, washing the neighborhood white",
          "The full moon lays a hard light across everything — shadows go black and sharp",
          "The full moon is conducting the neighborhood in its own key tonight",
          "There is a full moon overhead and it seems pleased about this",
          "Under a full moon this emphatic, every shadow takes a firm position",
          "The full moon has arrived and is converting everything below it into evidence of itself",
          "A full moon floods in from the east and makes the familiar look annotated",
          "The full moon tonight — you'd think we'd be used to it by now, and yet",
        ],
      },

      // Walking and running feel — keyed by tempBand → windBand.
      // The engine cascades: exact windBand → "windy"/"breezy" fallback → "default" → first key.
      // Only "default" is required per tempBand; other wind-band keys are optional enhancements.
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
          cold:     "The cold has the weight of the season behind it. It's not going anywhere soon.",
          cool:     "A cool day in winter still carries that low-angled, muted quality — the light stays thin.",
          mild:     "A mild winter day arrives like a brief negotiation, the season offering a temporary concession.",
          warm:     "Warm for this time of year — the kind of day that confuses the body and delights it anyway.",
        },
        spring: {
          freezing: "A freeze this late in the season feels like a dispute — the calendar says one thing, the thermometer another.",
          cold:     "A cold snap against the season's grain, stubbornly winter when everything else is turning.",
          cool:     "Classic spring air — not fully committed to warmth, but getting there.",
          mild:     "Spring at its most reliable: mild and improving, the air carrying a faint promise of heat to come.",
          warm:     "Early warmth, the kind that catches you off guard and makes you forget your jacket.",
          hot:      "Unseasonably hot for spring — the season skipping its middle chapter entirely.",
        },
        summer: {
          cool:      "Cool for summer — almost out of character, a small break from the pattern.",
          mild:      "The summer is being relatively gracious today.",
          warm:      "Standard summer warmth, steady and familiar, the season in its typical voice.",
          hot:       "Proper summer heat — unambiguous, committed, entirely itself.",
          scorching: "The summer at its most serious. This is the heat that defines the season in memory.",
        },
        autumn: {
          warm:     "Warm for autumn — borrowed time before the turn. Worth noting, worth savoring.",
          mild:     "A mild autumn day, the season at its most civilized and elegant.",
          cool:     "The cool has the weight of the season in it now. This is autumn meaning it.",
          cold:     "Autumn cold with teeth — the turn is complete, the next chapter already started.",
          freezing: "A hard frost in autumn — the cold arriving ahead of schedule, unwilling to wait.",
        },
      },

      // Thunderstorm texture (replaces rainTexture when it's actually storming)
      thunderstormTexture: [
        "When a storm moves through like this, temperature becomes almost irrelevant.",
        "The rain here is almost secondary to everything happening above it.",
        "Thunder changes the acoustics of the neighborhood entirely — everything goes wide and electric.",
        "The gaps between thunder are their own kind of weather.",
        "In a good storm, everything else is commentary.",
        "The rain doesn't care what you had planned.",
        "Out there the atmosphere is doing several things at once and enjoying all of them.",
        "The lightning keeps making the world flash into negative — a second of overexposure, then dark again.",
      ],

      // Rain-specific texture — keyed by temp band
      rainTexture: {
        cold: [
          "Cold rain is its own thing — damp and bone-finding in a way that dry cold isn't.",
          "Rain in cold air lands heavier than it is. You feel it settling in.",
          "Cold rain arrives like an argument you weren't ready for.",
          "Cold rain doesn't just get you wet — it gets you cold, in that order or simultaneously.",
        ],
        cool: [
          "Cool rain falls clean and deliberate, the kind that smells like the ground waking up.",
          "Rain in this temperature has a particular freshness to it — almost mineral.",
          "There is something extremely specific about the smell of cool rain on dry pavement.",
          "Cool rain and wet earth and the brisk feeling of being out in it anyway.",
        ],
        mild: [
          "Mild-weather rain is benign enough — you get wet, but it doesn't punish you for it.",
          "Rain at this temperature is more mood than misery.",
          "Mild rain, mild weather — you'd get wet but not punished for it.",
          "In mild conditions the rain is an inconvenience rather than a verdict.",
        ],
        warm: [
          "Warm rain is strange and tropical — you barely mind getting wet because the air catches you on the other side.",
          "Rain when it's warm feels almost like relief, the air finally doing something with all that moisture.",
          "Warm rain has a tropical quality — you get wet but the air catches you warm on the other side.",
          "Warm rain and bare arms — not unpleasant, actually.",
        ],
        freezing: [
          "Freezing rain is its own category of miserable — the wet finds you and the cold keeps it there.",
          "Rain in freezing air doesn't land so much as accumulate — each drop a small, cold argument.",
          "Cold rain below freezing has a particular clarity: you should go inside.",
        ],
        scorching: [
          "Rain in this heat is a relief that evaporates almost before it reaches you — warm, brief, and the ground drinks it instantly.",
          "Rain when it's scorching feels like the sky trying to help. It helps somewhat.",
          "Hot rain in serious heat: the water is warm, the air barely cools, but still — something.",
        ],
      },

      // Fog-specific texture
      fogTexture: [
        "Fog shortens the world to what's close. Familiar streets become unfamiliar at the edges.",
        "In fog, sound carries differently — voices, steps, a car door — clearer somehow, more deliberate.",
        "The fog has a particular smell to it: cold, green, and coastal.",
        "Visibility is limited but the detail of what's nearby gets sharper by contrast.",
        "Fog turns everything into silhouette past a certain distance.",
        "In thick fog the world contracts to a personal radius and gets very specific within it.",
        "The fog doesn't hide things so much as decline to confirm them.",
        "Fog turns familiar streets into a walking thought experiment about distance.",
        "The fog arrived without announcement and is making itself at home.",
        "In fog, the visible becomes vivid and the invisible becomes theoretical.",
        "Sound moves strangely in this — footsteps, a dog, a car door — each one closer than it is.",
      ],

      // Snow-specific texture
      snowTexture: [
        "Snow muffles things — traffic, footsteps, all the usual urban frequencies go soft.",
        "The light in snowfall is flat and even, shadowless, almost kind.",
        "Snow on the ground changes the acoustics of a neighborhood in ways that feel immediately obvious.",
        "Falling snow has the quality of a held breath — things slow, the air goes careful.",
        "Snow has opinions about noise, and enforces them.",
        "After snowfall, the familiar becomes a study in reduction — all clutter hidden, all edges softened.",
        "Walking in snow means your footsteps become visible and audible, a record of where you've been.",
        "The snow gives the neighborhood a quality of being recently edited.",
        "Under snow, the landscape practices a kind of honesty — showing only the essential forms of things.",
        "Snow light is its own thing: reflected upward, ambient, sourceless — the shadows go wrong in a good way.",
      ],

      // Fog scene lead phrases — complete the pattern: "{timeOpener}: {fogLead}."
      // Keep these lowercase; the template adds the period.
      fogLead: [
        "the fog has settled in",
        "fog has moved in and shortened everything",
        "the fog is sitting low and staying",
        "a heavy fog has rolled in",
        "fog has taken up residence out here",
        "the fog is doing what fog does — making the familiar strange",
        "fog has claimed the middle distance and isn't giving it back",
      ],

      // Movement feel during rain — replaces tempBand-specific movementFeel cascade.
      movementRain: [
        "You could walk in this if you wanted to — you'd arrive damp, but not broken by it.",
        "Walking in this is fine if you're dressed for it. The rain doesn't care about your schedule.",
        "It's walkable, but the rain has the advantage and knows it.",
        "Going out means getting wet. The question is whether you mind, and only you know that.",
      ],

    }, // end vocab

    // -------------------------------------------------------------------------
    // Writer voices — thematic overlays activated at low probability.
    // When a writer fires, their template replaces the standard narrative for
    // that generation. Salience still resolves ctx (determines the headline
    // condition); the writer determines the structural and prose expression.
    //
    // activationChance: probability (0–1) per generation. 0.08 ≈ 1-in-12.
    // 'template' must match a key in the engine's WRITER_TEMPLATE_FNS map.
    // -------------------------------------------------------------------------
    writers: {
      activationChance: 0.08,

      voices: [

        // -------------------------------------------------------------------
        // Thoreau — first-person journal walk, sensory precision → philosophy
        // -------------------------------------------------------------------
        {
          name: "thoreau",
          template: "thoreau",
          vocab: {

            opener: {
              "late-night": [
                "I went out past midnight and found",
                "The late-night air met me at the door with",
                "At this hour I stepped outside into",
              ],
              dawn: [
                "At first light I went out and found",
                "The dawn arrived with",
                "I walked out into the first light and encountered",
              ],
              morning: [
                "I went out this morning and found",
                "This morning the air held",
                "I stepped outside this morning into",
              ],
              afternoon: [
                "This afternoon I stepped outside into",
                "The afternoon had established",
                "I went out this afternoon and found",
              ],
              evening: [
                "This evening I found outside",
                "I stepped out at dusk into",
                "The evening air held",
              ],
              night: [
                "Tonight the air outside holds",
                "I went out tonight and found",
                "The night air has",
              ],
            },

            tempBody: {
              freezing: [
                "a cold that found the ears and cheeks before anything else — the kind that makes the whole enterprise of being outside feel like a transaction one has agreed to in advance",
                "an air so cold it has a mineral quality, each breath tasting of something below the surface of winter",
              ],
              cold: [
                "a clarifying chill I find I am glad of — it keeps the mind from wandering too far, which is occasionally useful",
                "cold enough that I can feel the precise boundary where my coat ends and the night begins",
              ],
              cool: [
                "that particular coolness that asks nothing of you but repays attention — the air at its most honest",
                "a freshness I would not trade for any warmth tonight — the body welcomes it before the mind does",
              ],
              mild: [
                "a mildness almost suspicious in its completeness — I kept waiting for a catch that did not come",
                "air exactly as it should be, which happens less often than one might expect and deserves noting when it does",
              ],
              warm: [
                "a warmth the stones have been storing all day and now give back freely — stepping outside is stepping into something that has been waiting",
                "warm enough that being outside is its own answer to the question of where to be",
              ],
              hot: [
                "a heat that had taken full possession of the afternoon — the shade had become a kind of shelter rather than a preference",
                "the sort of heat that makes a man honest about his limits more quickly than most things do",
              ],
              scorching: [
                "a heat that had left no room for negotiation — I noted it and retreated without ceremony",
                "the afternoon in full possession of itself, which is to say, entirely too hot for extended observation",
              ],
            },

            moonFull: [
              "The full moon had made the yard navigable without a lamp, which I found I was grateful for.",
              "A full moon had converted the familiar into something worth looking at again.",
              "The moon was bright enough that I could see the woodpile in detail — each log distinct in the cold light.",
              "The full moon lit the path clearly; I stood in it for a moment and let it.",
            ],

            observation: [
              "The yard was conducting its ordinary business without reference to my presence.",
              "A bird called once from the woodline and then thought better of it.",
              "The stillness had a quality of attention, as if something were listening.",
              "Everything had been arranged this way before I arrived and would remain so after.",
              "The crickets had something to say about all of it.",
              "Even the leaves seemed to know something I was still catching up to.",
              "I stood long enough to feel settled into it, then went back inside.",
              "The cold had opinions about my ears and they were persuasive.",
              "A light was on in a neighbor's window, and something about it suggested warmth without explaining anything.",
              "I stayed longer than I had meant to, which I have come to recognize as a reasonable measure of a thing's worth.",
              "There are no conclusions available at this hour — only the temperature, and the fact of being outside in it.",
              "The night was conducting its ordinary proceedings with its usual lack of concern for observers.",
              "Nothing happened, which was, as it frequently is, enough.",
            ],

            closing: {
              winter: [
                "Winter is making no apologies this evening.",
                "The season has come fully into its own voice.",
                "It will be colder before it is warmer — the calendar has nothing to say about it.",
                "There is an honesty to winter that I find clarifying, however much I might prefer warmth.",
                "The season is settled in its course — it will do what it does, on its own schedule.",
              ],
              spring: [
                "Spring is still deciding, which seems right for the season.",
                "The turn is coming — I could feel it in the quality of the light if not yet the thermometer.",
                "The season is working toward something, and I find I am content to wait for it.",
                "The air has a tentative quality I find encouraging, like a question that suspects its answer.",
                "One feels the turn coming — gradually, and then with sudden conviction.",
              ],
              summer: [
                "Summer at its most unambiguous.",
                "The season has no irony in it tonight.",
                "Everything is exactly what it presents itself as.",
                "The summer has committed fully and I find I appreciate the honesty in that.",
                "The season is carrying out its purpose without ambiguity, which I respect.",
              ],
              autumn: [
                "Autumn is doing what it does — which is to say, everything, and with purpose.",
                "The season has a clarity to it that summer never quite manages.",
                "The cold will be more permanent soon — tonight is a kind of notice.",
                "The season has made its peace with being what it is — there is a dignity in that, I think.",
                "Autumn is already becoming what it becomes — which is winter, at some remove, and without apology.",
              ],
            },
          },
        }, // end thoreau

        // -------------------------------------------------------------------
        // Dickinson — compressed, dashed, capitalized, interior witness
        // -------------------------------------------------------------------
        {
          name: "dickinson",
          template: "dickinson",
          vocab: {

            moon: [
              "The Moon — had changed the Yard — to something Else entirely.",
              "A Full Moon — arrived — the way important things do — without announcement.",
              "The Moon tonight — makes Witnesses — of Rooftops and Stones.",
              "One notes the Moon — and then — one's own smallness — in about that Order.",
            ],

            tempBody: {
              freezing: [
                "The Cold — does not arrive — it has always been here.",
                "A Freeze — that the Lungs — discover — before the Mind has decided to.",
              ],
              cold: [
                "The Cold — asks — and the Body — answers — before Thought intervenes.",
                "A Chill — that the Skin — translates — into something like Attention.",
              ],
              cool: [
                "The Air — tonight — has a Personality.",
                "Cool — which is to say — the Air — disagrees with Nothing.",
                "A certain Coolness — the kind one goes to meet — rather than avoid.",
              ],
              mild: [
                "The Temperature — has the quality — of Consent.",
                "Mild — meaning the Air — and the Body — have arrived — at an Agreement.",
              ],
              warm: [
                "Warmth — the kind the World offers — when it means — to be Kind.",
                "The Air — is Warm — which is another way of saying — it is on your side.",
              ],
              hot: [
                "The Heat — requires no introduction — it is already — in Possession.",
                "Hot — and the Body — understands — without being told.",
              ],
              scorching: [
                "The Heat today — has Opinions — and states them — without Reserve.",
              ],
            },

            sky: {
              clear: [
                "The Sky — unobstructed — which is a Kind — of Generosity.",
                "Clear overhead — meaning nothing — between the Eye — and Whatever lies beyond.",
              ],
              "partly-cloudy": [
                "The Clouds — and the Light — have entered — into negotiation.",
                "A partial Sky — which the Weather — has not yet decided about.",
              ],
              "mostly-cloudy": [
                "The Sky — has drawn a Curtain — of its own Choosing.",
              ],
              overcast: [
                "The Overcast — is thorough — the kind — that means it.",
                "A grey lid — sealed overhead — which has its own kind of permanence.",
              ],
              fog: [
                "Fog — is the World — contracting — to what is Near.",
                "The Fog — arrived — and shortened — every Distance.",
              ],
              rain: [
                "Rain — which has — its own Concerns.",
                "The Rain — falls — with the Conviction — of a Decision already made.",
              ],
              "heavy-rain": [
                "The Rain — is in Earnest now — this is not — a light matter.",
              ],
              snow: [
                "Snow — which edits — Everything.",
                "The Snow — has changed — the Syntax — of the Yard.",
              ],
              thunderstorm: [
                "The Storm — arrived — without Introduction.",
                "Thunder — which makes — its own Introductions.",
              ],
              default: [
                "The Night — holds — what it holds.",
                "The Sky — is doing — what it does.",
                "Weather — which arrives — without asking — and leaves the same way.",
              ],
            },

            closing: [
              "One goes inside — and takes the Cold with one — for a moment.",
              "It is enough — to have noted it.",
              "The Night continues — with or without — the Witness.",
              "The World proceeds — indifferently — which is its own kind of Comfort.",
              "This is the Weather — one woke into — and will sleep out of.",
              "What is Outside — will remain there — which is — the correct arrangement.",
              "The Cold — did what it came to do.",
              "One stepped inside — having noted things — the transaction — complete.",
              "The Night — continues — which is — its usual practice — with or without the Witness.",
              "Something was Outside — attending to itself — as it should.",
              "The Weather — passed through — as Weather does — on its own business.",
            ],
          },
        }, // end dickinson

        // -------------------------------------------------------------------
        // DFW — nested parentheticals, hyper-qualified, wry self-awareness
        // -------------------------------------------------------------------
        {
          name: "dfw",
          template: "dfw",
          vocab: {

            main: {
              moonLead: [
                "The full moon (which is, objectively, doing something to the light that the word 'silver' comes close to but somehow understates) has converted the neighborhood into a kind of study in contrast that, if you're paying attention — and it rewards attention — is genuinely striking.",
                "There is a full moon out tonight, and while 'full moon' is technically sufficient as a description, it doesn't quite capture the specific quality of light involved, which is more directional and emphatic than regular darkness and makes familiar things look like their own representations.",
              ],
              fog: [
                "The fog tonight is the specific coastal kind, which is to say it's not so much weather as it is the air deciding to be visible, and the effect — the way it contracts the world to whatever's close — is one of those things that sounds straightforward but turns out to be, in practice, genuinely strange.",
                "There's fog out there (the real kind, not thin haze, but the committed variety that makes distances into guesses and turns familiar streets into approximations of themselves) and the net effect is that being outside has a specific, close quality to it.",
              ],
              rain: [
                "It's raining outside in that particular way where the rain has clearly made a commitment — not dramatic, not weather-as-spectacle, just consistent purposeful rain that has apparently decided something and is following through on it, which if you think about it is actually kind of admirable.",
                "The rain (which has been doing this for a while and shows no sign of reconsidering) has a quality of settled purpose to it that is, if you're honest, more interesting than dramatic weather in the way that quiet conviction is more interesting than shouting.",
              ],
              snow: [
                "It's snowing, which is the kind of thing that sounds simple but turns out to do something specific to both the light and the sound outside — the snow itself being less interesting than what it does, which is to edit the world down to a quieter, more deliberate version of itself.",
              ],
              cold: [
                "The cold outside (which is real cold, not 'a bit chilly' cold, but the kind that finds the face immediately and makes the question of going outside into a small negotiation that the cold tends to win) is doing what genuine cold does — it clarifies things, which is not comfortable but is arguably useful.",
                "What registers first is the cold, which is specific and localized and doesn't pretend to be anything other than what it is, and there's something almost refreshing about that even when the something is, technically, freezing.",
              ],
              cool: [
                "The air tonight has a specific quality that the word 'cool' technically captures but somehow undersells — it's the kind of temperature where being outside feels like a reward for some good decision you made earlier, even if you can't identify what that decision was.",
                "There is something outside tonight that is cool in the particular way that cool air at night is cool (sharper than daytime cool, with more of what you might call intention), and the whole thing has a quality of being, if not perfect, close enough to perfect that the distinction stops mattering.",
              ],
              mild: [
                "There's something almost suspicious about how comfortable the air is tonight — meteorological equilibrium, technically, but in practice the kind of thing that makes a person briefly optimistic about everything else too, which may or may not be warranted but is at least pleasant.",
                "The air outside right now has reached some kind of agreement with the body that results in the sensation of neither too much nor too little of anything, which sounds like the absence of weather but is actually, it turns out, its own specific thing.",
              ],
              warm: [
                "The warmth outside tonight is the genuine kind (not just the absence of cold, but an actual presence — the kind the ground has been storing since midday and is now returning with interest), and the net effect is that being outside is its own argument for being outside.",
              ],
              hot: [
                "The heat outside right now is the serious kind, the kind that meets you immediately and stays close and makes the question of how long to remain outside into something you answer with your body before your brain has finished asking it.",
              ],
              default: [
                "The air outside right now has a specific quality that resists easy summary — it's not dramatic in any particular direction, but it's doing something, and that something turns out to be more interesting than the word 'fine' would suggest when you actually go stand in it for a moment.",
                "There is weather outside tonight, which is to say the air has a temperature and a character and a specific feel against the face, and all of this turns out to be, on balance, worth noting.",
              ],
            },

            closing: [
              "It's worth a moment outside, is the summary — the kind of night that turns out to have been the right kind.",
              "The whole thing has a quality of being exactly what it is, which is rarer than it sounds and, frankly, underrated.",
              "Worth going out for, is what it amounts to, even briefly.",
              "There is something here that resists easy description but also, usefully, doesn't seem to need it.",
              "You could take a walk. The air, for its part, would not object.",
              "The night is doing what nights do when they're doing it well, which this one appears to be.",
              "There is weather outside right now that is worth noting, and this has been the noting of it.",
              "The air, for its part, is doing what air does when it's doing it right, which turns out to be: something.",
              "Worth going outside briefly to check on — and the checking, it turns out, was worth it.",
              "You could take a walk right now and the weather would not object. It would, in fact, reward it.",
              "There's something out there that resists easy summary but also, usefully, doesn't seem to require one.",
            ],
          },
        }, // end dfw

      ], // end voices
    }, // end writers

  }; // end WeatherNarrativeConfig

})(window);
