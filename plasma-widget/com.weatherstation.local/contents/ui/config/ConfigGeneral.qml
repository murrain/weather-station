import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import org.kde.kirigami as Kirigami

Kirigami.FormLayout {
    id: configPage

    property alias cfg_apiEndpoint:    endpointField.text
    property alias cfg_updateInterval: intervalSpin.value
    property alias cfg_debugLayout:    debugSwitch.checked

    TextField {
        id: endpointField
        Kirigami.FormData.label: i18n("API Endpoint:")
        placeholderText: "http://192.168.8.30:8002/data/3.0/onecall"
        Layout.minimumWidth: Kirigami.Units.gridUnit * 22
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
