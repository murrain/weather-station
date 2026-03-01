import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import org.kde.kirigami as Kirigami

Kirigami.FormLayout {
    id: configPage

    property alias cfg_apiEndpoint:    endpointField.text
    property alias cfg_locationName:   locationField.text
    property alias cfg_tempPrecision:      precisionSpin.value
    property alias cfg_humidityPrecision:  humidityPrecisionSpin.value
    property alias cfg_updateInterval: intervalSpin.value
    property alias cfg_debugLayout:    debugSwitch.checked

    TextField {
        id: endpointField
        Kirigami.FormData.label: i18n("API Endpoint:")
        placeholderText: "http://192.168.8.30:8002/data/3.0/onecall"
        Layout.minimumWidth: Kirigami.Units.gridUnit * 22
    }

    Switch {
        id: locationOverrideSwitch
        Kirigami.FormData.label: i18n("Override location name:")
        checked: locationField.text !== ""
        onToggled: {
            if (!checked) locationField.text = ""
        }
    }

    TextField {
        id: locationField
        Kirigami.FormData.label: i18n("Location name:")
        placeholderText: i18n("e.g. Hollister, CA")
        Layout.minimumWidth: Kirigami.Units.gridUnit * 22
        visible: locationOverrideSwitch.checked
    }

    SpinBox {
        id: precisionSpin
        Kirigami.FormData.label: i18n("Temperature decimal places:")
        from: 0
        to: 2
    }

    SpinBox {
        id: humidityPrecisionSpin
        Kirigami.FormData.label: i18n("Humidity decimal places:")
        from: 0
        to: 2
    }

    SpinBox {
        id: intervalSpin
        Kirigami.FormData.label: i18n("Refresh interval (minutes):")
        from: 1
        to: 60
    }

    Switch {
        id: debugSwitch
        Kirigami.FormData.label: i18n("Debug layout:")
    }
}
