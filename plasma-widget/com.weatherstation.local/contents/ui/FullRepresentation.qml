import QtQuick
import QtQuick.Layouts
import org.kde.plasma.plasmoid
import org.kde.plasma.components 3.0 as PlasmaComponents
import org.kde.kirigami as Kirigami

Item {
    id: full

    implicitWidth:  Kirigami.Units.gridUnit * 24
    implicitHeight: Kirigami.Units.gridUnit * 24

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

        // ── Current: icon + temp | stats ──────────────────────────
        RowLayout {
            Layout.fillWidth: true
            spacing: Kirigami.Units.gridUnit

            // Icon + temperature + condition
            ColumnLayout {
                spacing: 2
                Layout.alignment: Qt.AlignTop

                RowLayout {
                    spacing: Kirigami.Units.smallSpacing

                    Kirigami.Icon {
                        source: root.kdeIcon
                        implicitWidth:  Kirigami.Units.iconSizes.huge
                        implicitHeight: Kirigami.Units.iconSizes.huge
                        Layout.alignment: Qt.AlignVCenter
                    }

                    PlasmaComponents.Label {
                        text: root.currentTempStr
                        font.pointSize: Kirigami.Theme.defaultFont.pointSize * 3.2
                        font.weight: Font.Light
                        lineHeight: 1
                    }
                }

                PlasmaComponents.Label {
                    text: root.conditionStr
                    font.pointSize: Kirigami.Theme.defaultFont.pointSize * 1.1
                    opacity: 0.75
                }

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

                PlasmaComponents.Label {
                    text: root.weatherData
                        ? "Feels like " + root.formatTemp(root.weatherData.current.feels_like)
                        : ""
                    font.pointSize: Kirigami.Theme.smallFont.pointSize
                    opacity: 0.55
                }
            }

            // Stats — single 2-column grid
            GridLayout {
                Layout.alignment: Qt.AlignTop
                columns: 2
                rowSpacing: Kirigami.Units.smallSpacing / 2
                columnSpacing: Kirigami.Units.largeSpacing

                PlasmaComponents.Label { text: "Humidity"; opacity: 0.55; font.pointSize: Kirigami.Theme.smallFont.pointSize }
                PlasmaComponents.Label { text: root.weatherData ? root.weatherData.current.humidity + "%" : "--"; font.pointSize: Kirigami.Theme.smallFont.pointSize }

                PlasmaComponents.Label { text: "Wind"; opacity: 0.55; font.pointSize: Kirigami.Theme.smallFont.pointSize }
                PlasmaComponents.Label { text: root.weatherData ? root.formatWind(root.weatherData.current.wind_speed) : "--"; font.pointSize: Kirigami.Theme.smallFont.pointSize }

                PlasmaComponents.Label { text: "Pressure"; opacity: 0.55; font.pointSize: Kirigami.Theme.smallFont.pointSize }
                PlasmaComponents.Label { text: root.weatherData ? root.weatherData.current.pressure + " hPa" : "--"; font.pointSize: Kirigami.Theme.smallFont.pointSize }

                PlasmaComponents.Label { text: "Dew point"; opacity: 0.55; font.pointSize: Kirigami.Theme.smallFont.pointSize }
                PlasmaComponents.Label { text: root.weatherData ? root.formatTemp(root.weatherData.current.dew_point) : "--"; font.pointSize: Kirigami.Theme.smallFont.pointSize }

                PlasmaComponents.Label { text: "Visibility"; opacity: 0.55; font.pointSize: Kirigami.Theme.smallFont.pointSize }
                PlasmaComponents.Label { text: root.weatherData ? root.formatVisibility(root.weatherData.current.visibility) : "--"; font.pointSize: Kirigami.Theme.smallFont.pointSize }
            }
        }

        // ── Divider ────────────────────────────────────────────────
        Rectangle {
            Layout.fillWidth: true
            height: 1
            color: Kirigami.Theme.textColor
            opacity: 0.12
        }

        // ── 7-day forecast with day/night split ────────────────────
        RowLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            spacing: 0

            // Day/Night labels column
            ColumnLayout {
                Layout.alignment: Qt.AlignTop
                Layout.fillWidth: false
                Layout.preferredWidth: Kirigami.Units.gridUnit * 3
                spacing: 0

                // Spacer to align with date + day name rows
                Item {
                    Layout.preferredHeight: dayLabelMetrics.height * 2 + Kirigami.Units.smallSpacing
                }

                PlasmaComponents.Label {
                    text: "Day"
                    font.pointSize: Kirigami.Theme.smallFont.pointSize
                    font.weight: Font.Medium
                    opacity: 0.55
                    Layout.preferredHeight: dayIconSize + dayTempMetrics.height + dayPopMetrics.height + Kirigami.Units.smallSpacing
                    verticalAlignment: Text.AlignVCenter
                }

                PlasmaComponents.Label {
                    text: "Night"
                    font.pointSize: Kirigami.Theme.smallFont.pointSize
                    font.weight: Font.Medium
                    opacity: 0.55
                    Layout.preferredHeight: dayIconSize + dayTempMetrics.height + dayPopMetrics.height + Kirigami.Units.smallSpacing
                    verticalAlignment: Text.AlignVCenter
                }
            }

            // Forecast columns
            Repeater {
                model: root.weatherData
                    ? Math.min(root.weatherData.daily.length, 7)
                    : 0

                delegate: ColumnLayout {
                    Layout.fillWidth: true
                    spacing: 0

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

                    // ── Day section ──
                    ColumnLayout {
                        Layout.preferredHeight: dayIconSize + dayTempMetrics.height + dayPopMetrics.height + Kirigami.Units.smallSpacing
                        spacing: 1

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
                    }

                    // ── Night section ──
                    ColumnLayout {
                        Layout.preferredHeight: dayIconSize + dayTempMetrics.height + dayPopMetrics.height + Kirigami.Units.smallSpacing
                        spacing: 1

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
        }
    }

    // ── Shared sizing constants for forecast rows ──────────────────
    readonly property int dayIconSize: Kirigami.Units.iconSizes.smallMedium

    TextMetrics {
        id: dayLabelMetrics
        text: "Today"
        font.pointSize: Kirigami.Theme.smallFont.pointSize
    }

    TextMetrics {
        id: dayTempMetrics
        text: "-22°C"
        font.pointSize: Kirigami.Theme.smallFont.pointSize
    }

    TextMetrics {
        id: dayPopMetrics
        text: "100%"
        font.pointSize: Kirigami.Theme.smallFont.pointSize
    }
}
