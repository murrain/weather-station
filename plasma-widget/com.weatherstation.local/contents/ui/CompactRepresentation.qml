import QtQuick
import QtQuick.Layouts
import org.kde.plasma.plasmoid
import org.kde.plasma.components 3.0 as PlasmaComponents
import org.kde.kirigami as Kirigami

MouseArea {
    id: compact

    onClicked: root.expanded = !root.expanded

    RowLayout {
        anchors.centerIn: parent
        spacing: Kirigami.Units.smallSpacing

        Kirigami.Icon {
            source: root.kdeIcon
            implicitWidth:  Math.min(compact.height, compact.width * 0.45)
            implicitHeight: implicitWidth
        }

        PlasmaComponents.Label {
            text: root.currentTempStr
            font.pixelSize: Math.max(
                Math.min(compact.height * 0.5, Kirigami.Units.gridUnit * 2),
                Kirigami.Theme.defaultFont.pixelSize
            )
            fontSizeMode: Text.Fit
            minimumPixelSize: Kirigami.Theme.smallFont.pixelSize
        }
    }
}
