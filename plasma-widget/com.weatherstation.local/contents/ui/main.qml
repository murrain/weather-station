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

    // Always rounded to integer for compact system tray display
    property string currentTempStr: (weatherData && weatherData.current)
        ? Math.round(convertTemp(weatherData.current.temp)) + tempSuffix()
        : "--"

    // Respects configured tempPrecision — used in popup and tooltip
    property string currentTemp: (weatherData && weatherData.current)
        ? formatTemp(weatherData.current.temp)
        : "--"

    property string locationName: Plasmoid.configuration.locationName
        || (weatherData && weatherData.name ? weatherData.name : "")
        || "Weather Station"

    property string conditionStr: (weatherData && weatherData.current
            && weatherData.current.weather && weatherData.current.weather.length > 0)
        ? capitalize(weatherData.current.weather[0].description)
        : (loading ? "Loading…" : "No data")

    // ── Representations ────────────────────────────────────────────
    compactRepresentation: CompactRepresentation {}
    fullRepresentation:    FullRepresentation {}

    // On desktop/panel threshold
    switchWidth:  Kirigami.Units.gridUnit * 10
    switchHeight: Kirigami.Units.gridUnit * 10

    Plasmoid.icon:  kdeIcon
    Plasmoid.title: ""

    toolTipMainText: conditionStr
    toolTipSubText:  currentTemp

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
        function onUpdateIntervalChanged() {
            refreshTimer.interval = (Plasmoid.configuration.updateInterval || 5) * 60 * 1000
            refreshTimer.restart()
        }
    }

    function fetchWeather() {
        loading  = true
        errorMsg = ""

        var endpoint = Plasmoid.configuration.apiEndpoint || "http://192.168.8.30:8002/data/3.0/onecall"
        var sep      = endpoint.indexOf("?") >= 0 ? "&" : "?"
        var url      = endpoint + sep + "units=metric"

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

    // ── Unit conversion (all data arrives in metric) ──────────────

    // Temperature: API sends °C
    function convertTemp(c) {
        var u = Plasmoid.configuration.tempUnit || "C"
        if (u === "F") return c * 9.0 / 5.0 + 32.0
        if (u === "K") return c + 273.15
        return c
    }

    function tempSuffix() {
        var u = Plasmoid.configuration.tempUnit || "C"
        if (u === "F") return "°F"
        if (u === "K") return " K"
        return "°C"
    }

    function formatTemp(val) {
        if (val === undefined || val === null) return "--"
        var p = Plasmoid.configuration.tempPrecision
        return convertTemp(val).toFixed(p !== undefined ? p : 1) + tempSuffix()
    }


    function formatHumidity(val) {
        if (val === undefined || val === null) return "--"
        var p = Plasmoid.configuration.humidityPrecision
        return Number(val).toFixed(p !== undefined ? p : 0) + "%"
    }

    // Wind: API sends m/s
    function formatWind(speed) {
        if (speed === undefined || speed === null) return "--"
        var u = Plasmoid.configuration.windUnit || "m/s"
        if (u === "km/h")  return Math.round(speed * 3.6) + " km/h"
        if (u === "mph")   return Math.round(speed * 2.237) + " mph"
        if (u === "knots") return Math.round(speed * 1.944) + " knots"
        return Math.round(speed) + " m/s"
    }

    // Pressure: API sends hPa
    function formatPressure(hpa) {
        if (hpa === undefined || hpa === null) return "--"
        var u = Plasmoid.configuration.pressureUnit || "hPa"
        if (u === "inHg") return (hpa * 0.02953).toFixed(2) + " inHg"
        if (u === "mmHg") return Math.round(hpa * 0.7501) + " mmHg"
        return Math.round(hpa) + " hPa"
    }

    // Visibility: API sends meters
    function formatVisibility(vis) {
        if (vis === undefined || vis === null) return "--"
        var u = Plasmoid.configuration.visibilityUnit || "km"
        if (u === "mi") {
            var miles = vis / 1609.34
            return miles >= 10 ? Math.round(miles) + " mi" : miles.toFixed(1) + " mi"
        }
        var km = vis / 1000.0
        return km >= 10 ? Math.round(km) + " km" : km.toFixed(1) + " km"
    }

    function formatDayShort(epoch) {
        var d    = new Date(epoch * 1000)
        var days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        return days[d.getDay()]
    }

    function capitalize(s) {
        if (!s) return ""
        return s.charAt(0).toUpperCase() + s.slice(1)
    }
}
