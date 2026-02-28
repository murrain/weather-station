import QtQuick
import QtQuick.Layouts
import org.kde.plasma.plasmoid
import org.kde.plasma.components 3.0 as PlasmaComponents
import org.kde.kirigami as Kirigami

MouseArea {
    id: compact

    onClicked: root.expanded = !root.expanded

    Kirigami.Icon {
        id: weatherIcon
        source: root.kdeIcon
        anchors.fill: parent
    }

    PlasmaComponents.Label {
        anchors.centerIn: parent
        text: root.currentTempStr
        font.pixelSize: Math.max(compact.height * 0.35, Kirigami.Theme.smallFont.pixelSize)
        font.weight: Font.Bold
        style: Text.Outline
        styleColor: Kirigami.Theme.backgroundColor
    }
}
