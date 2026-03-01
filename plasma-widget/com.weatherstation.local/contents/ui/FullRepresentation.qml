import QtQuick
import QtQuick.Layouts
import org.kde.plasma.plasmoid
import org.kde.plasma.components 3.0 as PlasmaComponents
import org.kde.kirigami as Kirigami

ColumnLayout {
    id: full

    Layout.preferredWidth:  Kirigami.Units.gridUnit * 25
    Layout.minimumWidth:    Kirigami.Units.gridUnit * 25

    readonly property bool dbg: Plasmoid.configuration.debugLayout || false
    readonly property color dbgHeader:   dbg ? "#20ff0000" : "transparent"
    readonly property color dbgCurrent:  dbg ? "#2000ff00" : "transparent"
    readonly property color dbgForecast: dbg ? "#200000ff" : "transparent"
    readonly property color dbgDayCol:   dbg ? "#20ff00ff" : "transparent"

    spacing: 0

    // ── Empty / error state ────────────────────────────────────────
    PlasmaComponents.Label {
        Layout.alignment: Qt.AlignCenter
        visible: !root.weatherData
        text: root.errorMsg   ? "⚠ " + root.errorMsg
            : root.loading    ? "Loading…"
            :                   "Waiting for data…"
        opacity: 0.6
    }

    // ── Header: title + last updated ──────────────────────────────
    RowLayout {
        Layout.fillWidth: true
        Layout.margins: Kirigami.Units.largeSpacing
        Layout.bottomMargin: 0
        visible: root.weatherData !== null

        Rectangle { anchors.fill: parent; color: dbgHeader; z: -1 }

        PlasmaComponents.Label {
            text: root.locationName
            font.weight: Font.Medium
            opacity: 0.55
        }

        Item { Layout.fillWidth: true }

        PlasmaComponents.Label {
            text: root.lastUpdated ? "Updated " + root.lastUpdated : ""
            font.pointSize: Kirigami.Theme.smallFont.pointSize
            opacity: 0.4
        }
    }

    // ── Current: icon | temp+condition | stats ────────────────
    RowLayout {
        Layout.fillWidth: true
        Layout.margins: Kirigami.Units.largeSpacing
        spacing: Kirigami.Units.gridUnit
        visible: root.weatherData !== null

        Rectangle { anchors.fill: parent; color: dbgCurrent; z: -1 }

        // Icon — matches height of the text column
        Kirigami.Icon {
            source: root.kdeIcon
            implicitWidth:  textColumn.height
            implicitHeight: textColumn.height
            Layout.alignment: Qt.AlignTop
        }

        // Temp + condition + hi/lo + feels like
        ColumnLayout {
            id: textColumn
            spacing: Kirigami.Units.smallSpacing
            Layout.alignment: Qt.AlignTop

            PlasmaComponents.Label {
                text: root.currentTemp
                font.pointSize: Kirigami.Theme.defaultFont.pointSize * 3.0
                font.weight: Font.Light
                lineHeight: 1
            }

            PlasmaComponents.Label {
                text: root.conditionStr
                opacity: 0.75
            }

            PlasmaComponents.Label {
                visible: root.weatherData
                      && root.weatherData.daily
                      && root.weatherData.daily.length > 0
                text: {
                    if (!root.weatherData || !root.weatherData.daily) return ""
                    var d = root.weatherData.daily[0]
                    return "↑ " + root.formatTemp(d.temp.max) + "  ↓ " + root.formatTemp(d.temp.min)
                }
                font.pointSize: Kirigami.Theme.smallFont.pointSize
                opacity: 0.6
            }

            PlasmaComponents.Label {
                text: root.weatherData
                    ? "Feels like " + root.formatTemp(root.weatherData.current.feels_like)
                    : ""
                font.pointSize: Kirigami.Theme.smallFont.pointSize
                opacity: 0.55
            }
        }

        // Stats — 2-column grid
        GridLayout {
            Layout.alignment: Qt.AlignTop
            columns: 2
            rowSpacing: Kirigami.Units.smallSpacing
            columnSpacing: Kirigami.Units.largeSpacing

            PlasmaComponents.Label { text: "Humidity"; opacity: 0.55; font.pointSize: Kirigami.Theme.smallFont.pointSize }
            PlasmaComponents.Label { text: root.weatherData ? root.formatHumidity(root.weatherData.current.humidity) : "--"; font.pointSize: Kirigami.Theme.smallFont.pointSize }

            PlasmaComponents.Label { text: "Wind"; opacity: 0.55; font.pointSize: Kirigami.Theme.smallFont.pointSize }
            PlasmaComponents.Label { text: root.weatherData ? root.formatWind(root.weatherData.current.wind_speed) : "--"; font.pointSize: Kirigami.Theme.smallFont.pointSize }

            PlasmaComponents.Label { text: "Pressure"; opacity: 0.55; font.pointSize: Kirigami.Theme.smallFont.pointSize }
            PlasmaComponents.Label { text: root.weatherData ? root.formatPressure(root.weatherData.current.pressure) : "--"; font.pointSize: Kirigami.Theme.smallFont.pointSize }

            PlasmaComponents.Label { text: "Dew point"; opacity: 0.55; font.pointSize: Kirigami.Theme.smallFont.pointSize }
            PlasmaComponents.Label { text: root.weatherData ? root.formatTemp(root.weatherData.current.dew_point) : "--"; font.pointSize: Kirigami.Theme.smallFont.pointSize }

            PlasmaComponents.Label { text: "Visibility"; opacity: 0.55; font.pointSize: Kirigami.Theme.smallFont.pointSize }
            PlasmaComponents.Label { text: root.weatherData ? root.formatVisibility(root.weatherData.current.visibility) : "--"; font.pointSize: Kirigami.Theme.smallFont.pointSize }
        }
    }

    // ── Divider ───────────────────────────────────────────────
    Rectangle {
        Layout.fillWidth: true
        Layout.leftMargin: Kirigami.Units.largeSpacing
        Layout.rightMargin: Kirigami.Units.largeSpacing
        Layout.topMargin: Kirigami.Units.mediumSpacing
        Layout.bottomMargin: Kirigami.Units.mediumSpacing
        height: 1
        color: Kirigami.Theme.textColor
        opacity: 0.12
        visible: root.weatherData !== null
    }

    // ── 7-day forecast ────────────────────────────────────────
    RowLayout {
        Layout.fillWidth: true
        Layout.leftMargin: Kirigami.Units.largeSpacing
        Layout.rightMargin: Kirigami.Units.largeSpacing
        Layout.bottomMargin: Kirigami.Units.largeSpacing
        spacing: 0
        visible: root.weatherData !== null

        Rectangle { anchors.fill: parent; color: dbgForecast; z: -1 }

        Repeater {
            model: root.weatherData
                ? Math.min(root.weatherData.daily.length, 7)
                : 0

            delegate: ColumnLayout {
                Layout.fillWidth: true
                Layout.topMargin: Kirigami.Units.smallSpacing
                Layout.bottomMargin: Kirigami.Units.smallSpacing
                spacing: 2

                Rectangle { anchors.fill: parent; color: dbgDayCol; z: -1 }

                // Calendar date
                PlasmaComponents.Label {
                    Layout.alignment: Qt.AlignHCenter
                    text: new Date(root.weatherData.daily[index].dt * 1000).getDate()
                    font.pointSize: Kirigami.Theme.smallFont.pointSize
                    font.weight: index === 0 ? Font.Medium : Font.Normal
                    opacity: index === 0 ? 1.0 : 0.55
                }

                // Day of week
                PlasmaComponents.Label {
                    Layout.alignment: Qt.AlignHCenter
                    text: index === 0 ? "Today" : root.formatDayShort(root.weatherData.daily[index].dt)
                    font.pointSize: Kirigami.Theme.smallFont.pointSize
                    font.weight: index === 0 ? Font.Medium : Font.Normal
                    opacity: index === 0 ? 1.0 : 0.65
                }

                // ── Day cell ──
                Kirigami.Icon {
                    Layout.alignment: Qt.AlignHCenter
                    source: {
                        var d = root.weatherData.daily[index]
                        if (d.day_detail && d.day_detail.weather && d.day_detail.weather.length > 0)
                            return root.owmIconToKde(d.day_detail.weather[0].icon)
                        return root.owmIconToKde((d.weather && d.weather.length > 0) ? d.weather[0].icon : null)
                    }
                    implicitWidth:  dayIconSize
                    implicitHeight: dayIconSize
                }

                PlasmaComponents.Label {
                    Layout.alignment: Qt.AlignHCenter
                    text: root.formatTemp(root.weatherData.daily[index].temp.max)
                    font.pointSize: Kirigami.Theme.smallFont.pointSize
                }

                PlasmaComponents.Label {
                    Layout.alignment: Qt.AlignHCenter
                    readonly property real pop: {
                        var d = root.weatherData.daily[index]
                        if (d.day_detail) return d.day_detail.pop || 0
                        return d.pop || 0
                    }
                    text: Math.round(pop * 100) + "%"
                    font.pointSize: Kirigami.Theme.smallFont.pointSize
                    color: pop > 0.4 ? Kirigami.Theme.linkColor : Kirigami.Theme.textColor
                    opacity: pop > 0.4 ? 1.0 : 0.45
                }

                // ── Day/night divider ──
                Rectangle {
                    Layout.fillWidth: true
                    Layout.leftMargin: Kirigami.Units.smallSpacing
                    Layout.rightMargin: Kirigami.Units.smallSpacing
                    height: 1
                    color: Kirigami.Theme.textColor
                    opacity: 0.08
                }

                // ── Night cell ──
                Kirigami.Icon {
                    Layout.alignment: Qt.AlignHCenter
                    source: {
                        var d = root.weatherData.daily[index]
                        if (d.night_detail && d.night_detail.weather && d.night_detail.weather.length > 0)
                            return root.owmIconToKde(d.night_detail.weather[0].icon)
                        return root.owmIconToKde((d.weather && d.weather.length > 0) ? d.weather[0].icon : null)
                    }
                    implicitWidth:  dayIconSize
                    implicitHeight: dayIconSize
                }

                PlasmaComponents.Label {
                    Layout.alignment: Qt.AlignHCenter
                    text: root.formatTemp(root.weatherData.daily[index].temp.night)
                    font.pointSize: Kirigami.Theme.smallFont.pointSize
                    opacity: 0.7
                }

                PlasmaComponents.Label {
                    Layout.alignment: Qt.AlignHCenter
                    readonly property real pop: {
                        var d = root.weatherData.daily[index]
                        if (d.night_detail) return d.night_detail.pop || 0
                        return d.pop || 0
                    }
                    text: Math.round(pop * 100) + "%"
                    font.pointSize: Kirigami.Theme.smallFont.pointSize
                    color: pop > 0.4 ? Kirigami.Theme.linkColor : Kirigami.Theme.textColor
                    opacity: pop > 0.4 ? 1.0 : 0.45
                }
            }
        }
    }

    // ── Shared sizing constants ───────────────────────────────────
    readonly property int dayIconSize: Kirigami.Units.iconSizes.large
}
