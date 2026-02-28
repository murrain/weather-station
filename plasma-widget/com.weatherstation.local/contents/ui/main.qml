import QtQuick
import QtQuick.Layouts
import org.kde.plasma.plasmoid
import org.kde.plasma.core as PlasmaCore
import org.kde.plasma.components 3.0 as PlasmaComponents
import org.kde.kirigami as Kirigami

PlasmoidItem {
    id: root

    // ── Shared state ───────────────────────────────────────────────
    property var weatherData: null
    property string lastUpdated: ""
    property bool loading: false
    property string errorMsg: ""

    // Derived helpers for quick access across representations
    property string kdeIcon: (weatherData && weatherData.current
            && weatherData.current.weather && weatherData.current.weather.length > 0)
        ? owmIconToKde(weatherData.current.weather[0].icon)
        : "weather-none-available"

    property string currentTempStr: (weatherData && weatherData.current)
        ? formatTemp(weatherData.current.temp)
        : "--"

    property string currentTempPrecise: (weatherData && weatherData.current)
        ? formatTempPrecise(weatherData.current.temp)
        : "--"

    property string conditionStr: (weatherData && weatherData.current
            && weatherData.current.weather && weatherData.current.weather.length > 0)
        ? capitalize(weatherData.current.weather[0].description)
        : (loading ? "Loading…" : "No data")

    // ── Representations ────────────────────────────────────────────
    compactRepresentation: CompactRepresentation {}
    fullRepresentation:    FullRepresentation {}

    // On desktop/panel threshold
    switchWidth:  Kirigami.Units.gridUnit * 14
    switchHeight: Kirigami.Units.gridUnit * 14

    Plasmoid.icon:  kdeIcon
    Plasmoid.title: "Weather Station"

    toolTipMainText: conditionStr
    toolTipSubText:  currentTempPrecise

    // ── Data fetching ──────────────────────────────────────────────
    Component.onCompleted: fetchWeather()

    Timer {
        id: refreshTimer
        interval: (Plasmoid.configuration.updateInterval || 5) * 60 * 1000
        running: true
        repeat: true
        onTriggered: fetchWeather()
    }

    // Re-fetch immediately when config changes
    Connections {
        target: Plasmoid.configuration
        function onApiEndpointChanged()    { fetchWeather() }
        function onUnitsChanged()          { fetchWeather() }
        function onUpdateIntervalChanged() {
            refreshTimer.interval = (Plasmoid.configuration.updateInterval || 5) * 60 * 1000
            refreshTimer.restart()
        }
    }

    function fetchWeather() {
        loading  = true
        errorMsg = ""

        var units    = Plasmoid.configuration.units       || "metric"
        var endpoint = Plasmoid.configuration.apiEndpoint || "http://192.168.8.30:8002/data/3.0/onecall"
        var sep      = endpoint.indexOf("?") >= 0 ? "&" : "?"
        var url      = endpoint + sep + "units=" + units

        var xhr = new XMLHttpRequest()
        xhr.open("GET", url)
        xhr.onreadystatechange = function () {
            if (xhr.readyState !== XMLHttpRequest.DONE) return
            loading = false
            if (xhr.status === 200) {
                try {
                    weatherData  = JSON.parse(xhr.responseText)
                    lastUpdated  = Qt.formatTime(new Date(), "h:mm AP")
                } catch (e) {
                    errorMsg = "Parse error"
                }
            } else {
                errorMsg = "HTTP " + (xhr.status || "error")
            }
        }
        xhr.send()
    }

    // ── OWM icon → KDE weather icon ───────────────────────────────
    function owmIconToKde(icon) {
        if (!icon) return "weather-none-available"
        var map = {
            "01d": "weather-clear",
            "01n": "weather-clear-night",
            "02d": "weather-few-clouds",
            "02n": "weather-few-clouds-night",
            "03d": "weather-clouds",
            "03n": "weather-clouds-night",
            "04d": "weather-many-clouds",
            "04n": "weather-many-clouds",
            "09d": "weather-showers-scattered",
            "09n": "weather-showers-scattered-night",
            "10d": "weather-showers",
            "10n": "weather-showers-night",
            "11d": "weather-storm",
            "11n": "weather-storm-night",
            "13d": "weather-snow",
            "13n": "weather-snow",
            "50d": "weather-fog",
            "50n": "weather-fog"
        }
        return map[icon] || "weather-none-available"
    }

    // ── Formatting helpers ─────────────────────────────────────────
    function formatTemp(val) {
        if (val === undefined || val === null) return "--"
        var u = Plasmoid.configuration.units || "metric"
        return Math.round(val) + (u === "metric" ? "°C" : "°F")
    }

    function formatTempPrecise(val) {
        if (val === undefined || val === null) return "--"
        var u = Plasmoid.configuration.units || "metric"
        return val.toFixed(1) + (u === "metric" ? "°C" : "°F")
    }

    function formatWind(speed) {
        if (speed === undefined || speed === null) return "--"
        var u = Plasmoid.configuration.units || "metric"
        return Math.round(speed) + (u === "metric" ? " m/s" : " mph")
    }

    function formatDayShort(epoch) {
        var d    = new Date(epoch * 1000)
        var days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        return days[d.getDay()]
    }

    function formatVisibility(vis) {
        if (vis === undefined || vis === null) return "--"
        var u = Plasmoid.configuration.units || "metric"
        if (u === "metric") {
            var km = vis / 1000.0
            return km >= 10 ? Math.round(km) + " km" : km.toFixed(1) + " km"
        }
        var miles = vis / 1609.34
        return miles >= 10 ? Math.round(miles) + " mi" : miles.toFixed(1) + " mi"
    }

    function capitalize(s) {
        if (!s) return ""
        return s.charAt(0).toUpperCase() + s.slice(1)
    }
}
