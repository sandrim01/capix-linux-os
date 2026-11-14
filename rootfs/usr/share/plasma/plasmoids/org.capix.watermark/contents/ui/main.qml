// Marca d'água no canto inferior direito da área de trabalho (como no Windows)
import QtQuick
import QtQuick.Layouts
import org.kde.plasma.plasmoid
import org.kde.plasma.core as PlasmaCore

PlasmoidItem {
    Plasmoid.backgroundHints: PlasmaCore.Types.NoBackground
    preferredRepresentation: fullRepresentation
    fullRepresentation: Item {
        Layout.preferredWidth: 260
        Layout.preferredHeight: 44
        Column {
            anchors.right: parent.right; anchors.bottom: parent.bottom
            spacing: 0
            Text { anchors.right: parent.right; text: "Capix Linux OS"; color: "white"; opacity: 0.55; font.pixelSize: 15; style: Text.Raised; styleColor: Qt.rgba(0, 0, 0, 0.25) }
            Text { anchors.right: parent.right; text: "by UnbugSTI"; color: "white"; opacity: 0.45; font.pixelSize: 12; style: Text.Raised; styleColor: Qt.rgba(0, 0, 0, 0.25) }
        }
    }
}
