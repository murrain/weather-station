import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import org.kde.kirigami as Kirigami

Kirigami.FormLayout {
    id: unitsPage

    property string cfg_tempUnit
    property string cfg_windUnit
    property string cfg_pressureUnit
    property string cfg_visibilityUnit

    ComboBox {
        id: tempCombo
        Kirigami.FormData.label: i18n("Temperature:")
        model: ["°C", "°F", "K"]
        readonly property var values: ["C", "F", "K"]
        currentIndex: Math.max(0, values.indexOf(cfg_tempUnit))
        onActivated: cfg_tempUnit = values[currentIndex]
    }

    ComboBox {
        id: windCombo
        Kirigami.FormData.label: i18n("Wind speed:")
        model: ["m/s", "km/h", "mph", "knots"]
        readonly property var values: ["m/s", "km/h", "mph", "knots"]
        currentIndex: Math.max(0, values.indexOf(cfg_windUnit))
        onActivated: cfg_windUnit = values[currentIndex]
    }

    ComboBox {
        id: pressureCombo
        Kirigami.FormData.label: i18n("Pressure:")
        model: ["hPa", "inHg", "mmHg"]
        readonly property var values: ["hPa", "inHg", "mmHg"]
        currentIndex: Math.max(0, values.indexOf(cfg_pressureUnit))
        onActivated: cfg_pressureUnit = values[currentIndex]
    }

    ComboBox {
        id: visCombo
        Kirigami.FormData.label: i18n("Visibility:")
        model: ["km", "mi"]
        readonly property var values: ["km", "mi"]
        currentIndex: Math.max(0, values.indexOf(cfg_visibilityUnit))
        onActivated: cfg_visibilityUnit = values[currentIndex]
    }
}
