import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import org.kde.kirigami as Kirigami

Kirigami.FormLayout {
    id: configPage

    property alias cfg_apiEndpoint:    endpointField.text
    property string cfg_units:         "metric"
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

    // Keep combo in sync when cfg_units is loaded from saved config
    onCfg_unitsChanged: unitsCombo.currentIndex = cfg_units === "metric" ? 1 : 0

    SpinBox {
        id: intervalSpin
        Kirigami.FormData.label: i18n("Refresh interval (minutes):")
        from: 1
        to: 60
    }
}
