import QtQuick
import QtQuick.Layouts
import org.kde.plasma.plasmoid
import org.kde.plasma.components 3.0 as PlasmaComponents
import org.kde.kirigami as Kirigami

Item {
    id: full

    implicitWidth:  Kirigami.Units.gridUnit * 24
    implicitHeight: Kirigami.Units.gridUnit * 20

    // ── Empty / error state ────────────────────────────────────────
    PlasmaComponents.Label {
        anchors.centerIn: parent
        visible: !root.weatherData
        text: root.errorMsg   ? "⚠ " + root.errorMsg
            : root.loading    ? "Loading…"
            :                   "Waiting for data…"
        opacity: 0.6
    }

    // ── Main content ───────────────────────────────────────────────
    ColumnLayout {
        anchors {
            fill: parent
            margins: Kirigami.Units.largeSpacing
        }
        visible: root.weatherData !== null
        spacing: Kirigami.Units.smallSpacing

        // ── Header: title + last updated ──────────────────────────
        RowLayout {
            Layout.fillWidth: true

            PlasmaComponents.Label {
                text: "Weather Station"
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

        // ── Current conditions ─────────────────────────────────────
        RowLayout {
            Layout.fillWidth: true
            spacing: Kirigami.Units.gridUnit

            // Large condition icon
            Kirigami.Icon {
                source: root.kdeIcon
                implicitWidth:  Kirigami.Units.iconSizes.enormous
                implicitHeight: Kirigami.Units.iconSizes.enormous
                Layout.alignment: Qt.AlignVCenter
            }

            ColumnLayout {
                spacing: 2
                Layout.alignment: Qt.AlignVCenter

                // Temperature
                PlasmaComponents.Label {
                    text: root.currentTempStr
                    font.pointSize: Kirigami.Theme.defaultFont.pointSize * 4
                    font.weight: Font.Light
                    lineHeight: 1
                }

                // Condition description
                PlasmaComponents.Label {
                    text: root.conditionStr
                    font.pointSize: Kirigami.Theme.defaultFont.pointSize * 1.1
                    opacity: 0.75
                }

                // High / Low
                PlasmaComponents.Label {
                    visible: root.weatherData
                          && root.weatherData.daily
                          && root.weatherData.daily.length > 0
                    text: {
                        if (!root.weatherData || !root.weatherData.daily) return ""
                        var d = root.weatherData.daily[0]
                        return "↑ " + root.formatTemp(d.temp.max) + "   ↓ " + root.formatTemp(d.temp.min)
                    }
                    opacity: 0.6
                }
            }
        }

        // ── Stats grid: feels like, humidity, wind, pressure ───────
        GridLayout {
            Layout.fillWidth: true
            columns: 4
            rowSpacing: Kirigami.Units.smallSpacing / 2
            columnSpacing: Kirigami.Units.largeSpacing

            // Feels like
            PlasmaComponents.Label {
                text: "Feels like"
                opacity: 0.55
                font.pointSize: Kirigami.Theme.smallFont.pointSize
            }
            PlasmaComponents.Label {
                text: root.weatherData ? root.formatTemp(root.weatherData.current.feels_like) : "--"
                font.pointSize: Kirigami.Theme.smallFont.pointSize
            }

            // Wind
            PlasmaComponents.Label {
                text: "Wind"
                opacity: 0.55
                font.pointSize: Kirigami.Theme.smallFont.pointSize
            }
            PlasmaComponents.Label {
                text: root.weatherData ? root.formatWind(root.weatherData.current.wind_speed) : "--"
                font.pointSize: Kirigami.Theme.smallFont.pointSize
            }

            // Humidity
            PlasmaComponents.Label {
                text: "Humidity"
                opacity: 0.55
                font.pointSize: Kirigami.Theme.smallFont.pointSize
            }
            PlasmaComponents.Label {
                text: root.weatherData ? root.weatherData.current.humidity + "%" : "--"
                font.pointSize: Kirigami.Theme.smallFont.pointSize
            }

            // Pressure
            PlasmaComponents.Label {
                text: "Pressure"
                opacity: 0.55
                font.pointSize: Kirigami.Theme.smallFont.pointSize
            }
            PlasmaComponents.Label {
                text: root.weatherData ? root.weatherData.current.pressure + " hPa" : "--"
                font.pointSize: Kirigami.Theme.smallFont.pointSize
            }

            // Dew point
            PlasmaComponents.Label {
                text: "Dew point"
                opacity: 0.55
                font.pointSize: Kirigami.Theme.smallFont.pointSize
            }
            PlasmaComponents.Label {
                text: root.weatherData ? root.formatTemp(root.weatherData.current.dew_point) : "--"
                font.pointSize: Kirigami.Theme.smallFont.pointSize
            }

            // Visibility
            PlasmaComponents.Label {
                text: "Visibility"
                opacity: 0.55
                font.pointSize: Kirigami.Theme.smallFont.pointSize
            }
            PlasmaComponents.Label {
                text: {
                    if (!root.weatherData) return "--"
                    var vis = root.weatherData.current.visibility
                    if (vis === undefined || vis === null) return "--"
                    var miles = vis / 1609.34
                    return miles >= 10 ? Math.round(miles) + " mi" : miles.toFixed(1) + " mi"
                }
                font.pointSize: Kirigami.Theme.smallFont.pointSize
            }
        }

        // ── Divider ────────────────────────────────────────────────
        Rectangle {
            Layout.fillWidth: true
            height: 1
            color: Kirigami.Theme.textColor
            opacity: 0.12
        }

        // ── 7-day forecast strip ───────────────────────────────────
        RowLayout {
            Layout.fillWidth: true
            spacing: 0

            Repeater {
                model: root.weatherData
                    ? Math.min(root.weatherData.daily.length, 7)
                    : 0

                delegate: ColumnLayout {
                    Layout.fillWidth: true
                    spacing: Kirigami.Units.smallSpacing / 2

                    // Day label
                    PlasmaComponents.Label {
                        Layout.alignment: Qt.AlignHCenter
                        text: index === 0 ? "Today" : root.formatDayShort(root.weatherData.daily[index].dt)
                        font.pointSize: Kirigami.Theme.smallFont.pointSize
                        font.weight: index === 0 ? Font.Medium : Font.Normal
                        opacity: index === 0 ? 1.0 : 0.65
                    }

                    // Condition icon
                    Kirigami.Icon {
                        Layout.alignment: Qt.AlignHCenter
                        source: root.owmIconToKde(root.weatherData.daily[index].weather[0].icon)
                        implicitWidth:  Kirigami.Units.iconSizes.medium
                        implicitHeight: Kirigami.Units.iconSizes.medium
                    }

                    // High temp
                    PlasmaComponents.Label {
                        Layout.alignment: Qt.AlignHCenter
                        text: root.formatTemp(root.weatherData.daily[index].temp.max)
                        font.pointSize: Kirigami.Theme.smallFont.pointSize
                    }

                    // Low temp
                    PlasmaComponents.Label {
                        Layout.alignment: Qt.AlignHCenter
                        text: root.formatTemp(root.weatherData.daily[index].temp.min)
                        font.pointSize: Kirigami.Theme.smallFont.pointSize
                        opacity: 0.55
                    }

                    // Precipitation probability
                    PlasmaComponents.Label {
                        Layout.alignment: Qt.AlignHCenter
                        readonly property real pop: root.weatherData.daily[index].pop || 0
                        text: Math.round(pop * 100) + "%"
                        font.pointSize: Kirigami.Theme.smallFont.pointSize
                        color: pop > 0.4 ? Kirigami.Theme.linkColor : Kirigami.Theme.textColor
                        opacity: pop > 0.4 ? 1.0 : 0.45
                    }
                }
            }
        }

        Item { Layout.fillHeight: true }
    }
}
