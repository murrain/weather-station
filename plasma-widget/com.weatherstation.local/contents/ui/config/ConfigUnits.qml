import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import org.kde.kirigami as Kirigami

Kirigami.FormLayout {
    id: unitsPage

    property string cfg_tempUnit:       "C"
    property string cfg_windUnit:       "m/s"
    property string cfg_pressureUnit:   "hPa"
    property string cfg_visibilityUnit: "km"

    ComboBox {
        id: tempCombo
        Kirigami.FormData.label: i18n("Temperature:")
        model: ["°C", "°F", "K"]
        readonly property var values: ["C", "F", "K"]
        currentIndex: values.indexOf(cfg_tempUnit)
        onActivated: cfg_tempUnit = values[currentIndex]
    }
    onCfg_tempUnitChanged: tempCombo.currentIndex = tempCombo.values.indexOf(cfg_tempUnit)

    ComboBox {
        id: windCombo
        Kirigami.FormData.label: i18n("Wind speed:")
        model: ["m/s", "km/h", "mph", "knots"]
        readonly property var values: ["m/s", "km/h", "mph", "knots"]
        currentIndex: values.indexOf(cfg_windUnit)
        onActivated: cfg_windUnit = values[currentIndex]
    }
    onCfg_windUnitChanged: windCombo.currentIndex = windCombo.values.indexOf(cfg_windUnit)

    ComboBox {
        id: pressureCombo
        Kirigami.FormData.label: i18n("Pressure:")
        model: ["hPa", "inHg", "mmHg"]
        readonly property var values: ["hPa", "inHg", "mmHg"]
        currentIndex: values.indexOf(cfg_pressureUnit)
        onActivated: cfg_pressureUnit = values[currentIndex]
    }
    onCfg_pressureUnitChanged: pressureCombo.currentIndex = pressureCombo.values.indexOf(cfg_pressureUnit)

    ComboBox {
        id: visCombo
        Kirigami.FormData.label: i18n("Visibility:")
        model: ["km", "mi"]
        readonly property var values: ["km", "mi"]
        currentIndex: values.indexOf(cfg_visibilityUnit)
        onActivated: cfg_visibilityUnit = values[currentIndex]
    }
    onCfg_visibilityUnitChanged: visCombo.currentIndex = visCombo.values.indexOf(cfg_visibilityUnit)
}
