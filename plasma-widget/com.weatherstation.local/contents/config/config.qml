import QtQuick
import org.kde.plasma.configuration

ConfigModel {
    ConfigCategory {
        name: i18n("General")
        icon: "configure"
        source: "config/ConfigGeneral.qml"
    }
    ConfigCategory {
        name: i18n("Units")
        icon: "kruler"
        source: "config/ConfigUnits.qml"
    }
}
