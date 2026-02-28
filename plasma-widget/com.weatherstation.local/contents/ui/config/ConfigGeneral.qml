import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import org.kde.kirigami as Kirigami

Kirigami.FormLayout {
    id: configPage

    // KDE config binding: cfg_<name> properties are auto-synced with main.xml entries
    property alias cfg_apiEndpoint:    endpointField.text
    property string cfg_units:         "imperial"
    property alias cfg_updateInterval: intervalSpin.value

    TextField {
        id: endpointField
        Kirigami.FormData.label: i18n("API Endpoint:")
        placeholderText: "http://192.168.8.30:8002/data/3.0/onecall"
        Layout.minimumWidth: Kirigami.Units.gridUnit * 22
    }

    ComboBox {
        id: unitsCombo
        Kirigami.FormData.label: i18n("Units:")
        model: [i18n("Imperial (°F, mph)"), i18n("Metric (°C, m/s)")]
        currentIndex: cfg_units === "metric" ? 1 : 0
        onActivated: cfg_units = currentIndex === 1 ? "metric" : "imperial"
    }

    SpinBox {
        id: intervalSpin
        Kirigami.FormData.label: i18n("Refresh interval (minutes):")
        from: 1
        to: 60
    }
}
