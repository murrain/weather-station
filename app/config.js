(function (global) {
    "use strict";

    global.WEATHER_CONFIG = {
        data: {
            updateIntervalMs: 10000,
        },
        narrative: {
            minHoldMs: 5 * 60 * 1000,
            maxHoldMs: 30 * 60 * 1000,
            tempDeltaC: 0.8,
            humidityDeltaPct: 5,
            tempBandHysteresisC: 0.3,
            humidityBandHysteresisPct: 2,
        },
    };
})(window);
