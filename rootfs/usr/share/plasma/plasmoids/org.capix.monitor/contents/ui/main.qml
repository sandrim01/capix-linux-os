// Capix Monitor — widget de área de trabalho com as métricas do computador (Plasma 6)
// Dados: /usr/libexec/capix/sysmetrics (JSON), lido a cada 1,5 s pelo motor "executable".
import QtQuick
import QtQuick.Layouts
import org.kde.plasma.plasmoid
import org.kde.plasma.core as PlasmaCore
import org.kde.plasma.plasma5support as P5Support

PlasmoidItem {
    id: root
    Plasmoid.backgroundHints: PlasmaCore.Types.NoBackground
    preferredRepresentation: fullRepresentation

    readonly property color cream: "#F2F2F2"
    readonly property color muted: "#ABABB2"
    readonly property color orange: "#F68B2C"
    readonly property color green: "#7CC74B"
    readonly property color blue: "#5AB4FF"
    readonly property int histLen: 60

    property var m: null
    property var hCpu: []
    property var hMem: []
    property var hGpu: []
    property var hDown: []
    property var hUp: []

    function pushHist(arr, v) { var a = arr.slice(); a.push(v); while (a.length > histLen) a.shift(); return a }
    function gb(b) { return (b / 1073741824).toFixed(b >= 1e11 ? 0 : 1) + " GB" }
    function rate(b) {
        if (b >= 1048576) return (b / 1048576).toFixed(1) + " MB/s"
        if (b >= 1024) return (b / 1024).toFixed(0) + " KB/s"
        return Math.round(b) + " B/s"
    }
    function upt(s) {
        var d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), mi = Math.floor(s % 3600 / 60)
        return (d ? d + "d " : "") + h + "h " + (mi < 10 ? "0" : "") + mi + "min"
    }
    function level(v) { return v >= 90 ? "#FF6B5B" : v >= 70 ? "#FFB23D" : orange }
    function tempColor(t) { return t >= 85 ? "#FF6B5B" : t >= 70 ? "#FFB23D" : muted }

    P5Support.DataSource {
        id: exe
        engine: "executable"
        connectedSources: []
        onNewData: function(source, data) {
            disconnectSource(source)
            try {
                var j = JSON.parse(data["stdout"])
                root.m = j
                root.hCpu = root.pushHist(root.hCpu, j.cpu.usage)
                root.hMem = root.pushHist(root.hMem, j.mem.total ? j.mem.used / j.mem.total * 100 : 0)
                root.hGpu = root.pushHist(root.hGpu, j.gpus.length && j.gpus[0].usage !== undefined ? j.gpus[0].usage : 0)
                root.hDown = root.pushHist(root.hDown, j.net.down)
                root.hUp = root.pushHist(root.hUp, j.net.up)
            } catch (e) {}
        }
    }
    Timer {
        interval: 1500; running: true; repeat: true; triggeredOnStart: true
        onTriggered: exe.connectSource("/usr/libexec/capix/sysmetrics")
    }
    P5Support.DataSource { id: launcher; engine: "executable"; connectedSources: []; onNewData: function(s) { disconnectSource(s) } }

    // ------- componentes -------
    component Bar: Item {
        property real value: 0
        property color color: root.level(value)
        Layout.fillWidth: true
        implicitHeight: 6
        Rectangle { anchors.fill: parent; radius: 3; color: Qt.rgba(1, 1, 1, 0.10) }
        Rectangle {
            width: parent.width * Math.max(0, Math.min(1, parent.value / 100)); height: parent.height; radius: 3; color: parent.color
            Behavior on width { NumberAnimation { duration: 400; easing.type: Easing.OutCubic } }
        }
    }
    component Spark: Canvas {
        property var points: []
        property var points2: []
        property color color: root.orange
        property color color2: root.blue
        property real maxValue: 100      // 0 = automático
        Layout.fillWidth: true
        implicitHeight: 34
        onPointsChanged: requestPaint()
        onPaint: {
            var ctx = getContext("2d"); ctx.reset()
            var all = points.concat(points2), mx = maxValue > 0 ? maxValue : Math.max(1, Math.max.apply(null, all.length ? all : [1]) * 1.15)
            function draw(arr, c, fill) {
                if (arr.length < 2) return
                var step = width / (root.histLen - 1), x0 = width - (arr.length - 1) * step
                ctx.beginPath()
                for (var i = 0; i < arr.length; i++) {
                    var x = x0 + i * step, y = height - 1 - (arr[i] / mx) * (height - 2)
                    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
                }
                ctx.strokeStyle = c; ctx.lineWidth = 1.6; ctx.stroke()
                if (fill) {
                    ctx.lineTo(width, height); ctx.lineTo(x0, height); ctx.closePath()
                    ctx.fillStyle = Qt.rgba(c.r, c.g, c.b, 0.18); ctx.fill()
                }
            }
            draw(points, color, true); draw(points2, color2, false)
        }
    }
    component Label: Text { color: root.cream; font.pixelSize: 12; elide: Text.ElideRight }
    component Muted: Text { color: root.muted; font.pixelSize: 11; elide: Text.ElideRight }
    component Section: RowLayout {
        property string title
        property string right
        Layout.fillWidth: true; Layout.topMargin: 6
        Text { text: parent.title; color: root.orange; font.pixelSize: 11; font.bold: true; font.letterSpacing: 1 }
        Item { Layout.fillWidth: true }
        Muted { text: parent.right }
    }

    fullRepresentation: Item {
        Layout.minimumWidth: 300
        Layout.preferredWidth: 320
        Layout.preferredHeight: card.implicitHeight
        Layout.minimumHeight: card.implicitHeight

        Rectangle {
            id: card
            anchors.fill: parent
            implicitHeight: col.implicitHeight + 28
            radius: 10
            color: Qt.rgba(0.086, 0.086, 0.094, 0.80)
            border.color: Qt.rgba(1, 1, 1, 0.12)

            ColumnLayout {
                id: col
                anchors { left: parent.left; right: parent.right; top: parent.top; margins: 14 }
                spacing: 4

                // cabeçalho
                RowLayout {
                    Layout.fillWidth: true
                    Image { source: "file:///usr/share/pixmaps/capix-logo.png"; sourceSize.width: 22; sourceSize.height: 22; Layout.preferredWidth: 22; Layout.preferredHeight: 22 }
                    Text { text: "Capix Monitor"; color: root.cream; font.pixelSize: 14; font.bold: true }
                    Item { Layout.fillWidth: true }
                    Muted { text: root.m ? "ligado há " + root.upt(root.m.uptime) : "" }
                }

                // ---------- PROCESSADOR ----------
                Section { title: "PROCESSADOR"; right: root.m ? (root.m.cpu.freq ? (root.m.cpu.freq / 1000).toFixed(2) + " GHz" : "") : "" }
                RowLayout {
                    Layout.fillWidth: true
                    Text { text: root.m ? Math.round(root.m.cpu.usage) + "%" : "—"; color: root.cream; font.pixelSize: 26; font.weight: Font.Light; Layout.preferredWidth: 70 }
                    ColumnLayout {
                        Layout.fillWidth: true; spacing: 2
                        Muted { Layout.fillWidth: true; text: root.m ? root.m.cpu.model : "" }
                        Muted {
                            visible: root.m && root.m.cpu.temp
                            text: root.m && root.m.cpu.temp ? "🌡 " + Math.round(root.m.cpu.temp) + " °C" : ""
                            color: root.m && root.m.cpu.temp ? root.tempColor(root.m.cpu.temp) : root.muted
                        }
                    }
                }
                Spark { points: root.hCpu }
                // núcleos
                Flow {
                    Layout.fillWidth: true; spacing: 3
                    Repeater {
                        model: root.m ? root.m.cpu.cores : []
                        Rectangle {
                            width: Math.max(8, Math.min(18, (col.width - 3 * 15) / 16)); height: 22; radius: 2
                            color: Qt.rgba(1, 1, 1, 0.08)
                            Rectangle { anchors.bottom: parent.bottom; width: parent.width; radius: 2; height: parent.height * Math.min(1, modelData / 100); color: root.level(modelData) }
                        }
                    }
                }

                // ---------- MEMÓRIA ----------
                Section { title: "MEMÓRIA"; right: root.m ? root.gb(root.m.mem.used) + " de " + root.gb(root.m.mem.total) : "" }
                Bar { value: root.m && root.m.mem.total ? root.m.mem.used / root.m.mem.total * 100 : 0 }
                Muted {
                    visible: root.m && root.m.mem.swap_total > 0
                    text: root.m ? "Swap: " + root.gb(root.m.mem.swap_used) + " de " + root.gb(root.m.mem.swap_total) : ""
                }

                // ---------- PLACA DE VÍDEO ----------
                Repeater {
                    model: root.m ? root.m.gpus : []
                    ColumnLayout {
                        Layout.fillWidth: true; spacing: 3
                        Section {
                            title: "PLACA DE VÍDEO · " + modelData.name.toUpperCase()
                            right: (modelData.temp ? Math.round(modelData.temp) + " °C" : "") + (modelData.power ? " · " + Math.round(modelData.power) + " W" : "")
                        }
                        RowLayout {
                            Layout.fillWidth: true
                            Label { text: modelData.usage !== undefined ? Math.round(modelData.usage) + "%" : "—"; Layout.preferredWidth: 42 }
                            Bar { value: modelData.usage || 0 }
                        }
                        Spark { visible: index === 0; points: root.hGpu; color: "#B07CFF"; implicitHeight: 24 }
                        Muted {
                            visible: modelData.vram_total !== undefined
                            text: modelData.vram_total ? "VRAM " + root.gb(modelData.vram_used) + " de " + root.gb(modelData.vram_total) : ""
                        }
                    }
                }

                // ---------- DISCOS ----------
                Section { title: "ARMAZENAMENTO"; right: root.m ? "↓ " + root.rate(root.m.diskio.read) + "  ↑ " + root.rate(root.m.diskio.write) : "" }
                Repeater {
                    model: root.m ? root.m.disks : []
                    ColumnLayout {
                        Layout.fillWidth: true; spacing: 2
                        RowLayout {
                            Layout.fillWidth: true
                            Label { text: modelData.mount === "/" ? "Sistema" : modelData.mount; Layout.fillWidth: true }
                            Muted { text: root.gb(modelData.total - modelData.used) + " livres de " + root.gb(modelData.total) }
                        }
                        Bar { value: modelData.used / modelData.total * 100 }
                    }
                }
                Muted { visible: root.m && root.m.nvme_temp; text: root.m && root.m.nvme_temp ? "SSD: " + Math.round(root.m.nvme_temp) + " °C" : "" }

                // ---------- REDE ----------
                Section { title: "REDE"; right: "" }
                RowLayout {
                    Layout.fillWidth: true
                    Label { text: "↓ " + (root.m ? root.rate(root.m.net.down) : "—"); color: root.green; Layout.fillWidth: true }
                    Label { text: "↑ " + (root.m ? root.rate(root.m.net.up) : "—"); color: root.blue }
                }
                Spark { points: root.hDown; points2: root.hUp; color: root.green; maxValue: 0 }

                // ---------- BATERIA ----------
                RowLayout {
                    visible: root.m && root.m.battery
                    Layout.fillWidth: true
                    Section { title: "BATERIA"; right: root.m && root.m.battery ? (root.m.battery.status === "Charging" ? "carregando" : root.m.battery.status === "Full" ? "carregada" : "na bateria") + (root.m.battery.watts ? " · " + root.m.battery.watts.toFixed(1) + " W" : "") : "" }
                }
                RowLayout {
                    visible: root.m && root.m.battery
                    Layout.fillWidth: true
                    Label { text: root.m && root.m.battery ? Math.round(root.m.battery.percent) + "%" : ""; Layout.preferredWidth: 42 }
                    Bar { value: root.m && root.m.battery ? root.m.battery.percent : 0; color: root.m && root.m.battery && root.m.battery.percent < 20 ? "#FF6B5B" : root.green }
                }

                // ---------- PROCESSOS ----------
                Section { title: "PROCESSOS"; right: root.m ? root.m.nproc + " em execução · carga " + root.m.load[0].toFixed(2) : "" }
                Repeater {
                    model: root.m ? root.m.procs : []
                    RowLayout {
                        Layout.fillWidth: true
                        Label { text: modelData.name; Layout.fillWidth: true }
                        Muted { text: (modelData.mem / 1048576).toFixed(0) + " MB"; Layout.preferredWidth: 60; horizontalAlignment: Text.AlignRight }
                        Label { text: modelData.cpu.toFixed(1) + "%"; Layout.preferredWidth: 46; horizontalAlignment: Text.AlignRight; color: modelData.cpu > 50 ? "#FFB23D" : root.cream }
                    }
                }
                Muted { Layout.alignment: Qt.AlignRight; Layout.topMargin: 6; text: "by UnbugSTI"; opacity: 0.7; font.pixelSize: 10 }
            }

            MouseArea {
                anchors.fill: parent
                acceptedButtons: Qt.LeftButton
                onDoubleClicked: launcher.connectSource("plasma-systemmonitor")
                cursorShape: Qt.PointingHandCursor
            }
        }
    }
}
