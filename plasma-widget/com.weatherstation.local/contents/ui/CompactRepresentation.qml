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

    // Gradient fade: bottom 40% of icon fades to panel background
    Rectangle {
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.bottom: parent.bottom
        height: parent.height * 0.45
        gradient: Gradient {
            GradientStop { position: 0.0; color: "transparent" }
            GradientStop { position: 0.55; color: Kirigami.Theme.backgroundColor }
        }
    }

    PlasmaComponents.Label {
        anchors.horizontalCenter: parent.horizontalCenter
        anchors.bottom: parent.bottom
        text: root.currentTempStr
        font.pixelSize: Math.max(compact.height * 0.3, Kirigami.Theme.smallFont.pixelSize)
        font.weight: Font.Bold
        color: Kirigami.Theme.textColor
    }
}
