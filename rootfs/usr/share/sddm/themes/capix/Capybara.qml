// Capix — capivara do cafezinho (tela de login, SDDM / Qt 6)
// Desenho recortado em 3 camadas: corpo, cabeça e xícara (tools/split-drawing.py).
//  - usuário: abre o olhinho e acompanha o cursor do texto
//  - senha:   a cabeça desce, a xícara sobe até a boca e ela toma um gole de olhos fechados
//  - erro:    baixa a xícara, sobrancelha triste e balança a cabeça dizendo "não"
//  - sucesso: fecha os olhos e cora
// Coordenadas no tamanho do desenho original: 208 x 269.
import QtQuick 2.15
import "assets/layers.js" as Layers

Item {
    id: capy
    width: 232; height: 300

    // ---- API ----
    property string mode: "idle"      // "idle" | "user" | "pass" | "peek" | "happy"
    property real caret: 0.5
    property real mouseDX: 0
    property real mouseDY: 0
    property bool sad: false
    function shake() { sad = true; shakeAnim.restart(); sadTimer.restart() }

    readonly property real s: width / 208
    readonly property real r: caret - 0.5
    readonly property var neck: [110, 126.7]
    readonly property var cupCenter: [57, 150]

    readonly property string eyes: sad ? "sad" : mode === "happy" ? "happy"
                                 : (mode === "pass" && sip > 0.4) ? "closed" : "open"

    property real pupilX: sad ? 0 : mode === "user" ? r * 5 : mode === "peek" ? -0.5 : Math.max(-2.6, Math.min(2.6, mouseDX * 10))
    property real pupilY: sad ? 1 : (mode === "user" || mode === "peek") ? 1.8 : Math.max(-2, Math.min(2, mouseDY * 9))
    property real lean:   mode === "user" ? r * 2.5 : Math.max(-1.5, Math.min(1.5, mode === "idle" ? mouseDX * 3 : 0))
    property real sip:    sad ? 0 : mode === "pass" ? 1 : mode === "peek" ? 0.75 : 0
    Behavior on pupilX { NumberAnimation { duration: 160; easing.type: Easing.OutQuad } }
    Behavior on pupilY { NumberAnimation { duration: 160; easing.type: Easing.OutQuad } }
    Behavior on lean   { NumberAnimation { duration: 300; easing.type: Easing.OutQuad } }
    Behavior on sip    { NumberAnimation { duration: 750; easing.type: Easing.InOutQuad } }

    // ---- balançar a cabeça "não" ----
    property real shakeAngle: 0
    SequentialAnimation {
        id: shakeAnim
        NumberAnimation { target: capy; property: "shakeAngle"; to: -11; duration: 70 }
        NumberAnimation { target: capy; property: "shakeAngle"; to: 10;  duration: 140 }
        NumberAnimation { target: capy; property: "shakeAngle"; to: -8;  duration: 140 }
        NumberAnimation { target: capy; property: "shakeAngle"; to: 6;   duration: 120 }
        NumberAnimation { target: capy; property: "shakeAngle"; to: -3;  duration: 110 }
        NumberAnimation { target: capy; property: "shakeAngle"; to: 0;   duration: 90  }
    }
    Timer { id: sadTimer; interval: 1800; onTriggered: capy.sad = false }

    // ---- piscar ----
    property real blink: 0
    SequentialAnimation {
        id: blinkAnim
        NumberAnimation { target: capy; property: "blink"; to: 1; duration: 90 }
        NumberAnimation { target: capy; property: "blink"; to: 0; duration: 110 }
    }
    Timer { interval: 3000; running: true; repeat: true; onTriggered: { blinkAnim.restart(); interval = 2200 + Math.random() * 3000 } }

    // ---- respiração ----
    property real breath: 1
    SequentialAnimation on breath {
        loops: Animation.Infinite
        NumberAnimation { to: 1.008; duration: 1400; easing.type: Easing.InOutSine }
        NumberAnimation { to: 0.992; duration: 1400; easing.type: Easing.InOutSine }
    }

    // ---- vapor (12 quadros, loop de 2 s) ----
    property int steamFrame: 0
    Timer { interval: 166; running: true; repeat: true; onTriggered: capy.steamFrame = (capy.steamFrame + 1) % 12 }

    // camada posicionada pela caixa recortada
    component Layer: Image {
        property string name
        x: Layers.box[name][0] * capy.s; y: Layers.box[name][1] * capy.s
        width: Layers.box[name][2] * capy.s; height: Layers.box[name][3] * capy.s
        source: "assets/capy-" + name + ".png"; smooth: true; mipmap: true
    }
    // camada do tamanho do desenho todo
    component Full: Image { width: 208 * capy.s; height: 269 * capy.s; smooth: true; mipmap: true }

    Item {
        id: figure
        width: 208 * capy.s; height: 269 * capy.s
        transform: [
            Scale { origin.x: 110 * capy.s; origin.y: 269 * capy.s; yScale: capy.breath },
            Rotation { origin.x: 110 * capy.s; origin.y: 269 * capy.s; angle: capy.lean + capy.shakeAngle * 0.15 }
        ]

        Layer { name: "base" }

        Item {   // cabeça
            width: figure.width; height: figure.height
            transform: Rotation { origin.x: capy.neck[0] * capy.s; origin.y: capy.neck[1] * capy.s; angle: capy.shakeAngle - 13 * capy.sip }
            Layer { name: "head" }
            Full { source: "assets/eye-patch.png"; visible: capy.eyes === "open" || capy.eyes === "sad" }
            Image {
                width: 12 * capy.s; height: 12 * capy.s
                x: (117 - 6 + capy.pupilX) * capy.s; y: (75.5 - 6 + capy.pupilY) * capy.s
                source: "assets/eye-open.png"; smooth: true; mipmap: true
                visible: capy.eyes === "open" || capy.eyes === "sad"
                transform: Scale { origin.x: 6 * capy.s; origin.y: 6 * capy.s; yScale: 1 - capy.blink * 0.9 }
            }
            Full { source: "assets/sad-brow.png"; visible: capy.eyes === "sad" }
            Full { source: "assets/blush.png"; visible: capy.eyes === "happy" }
        }

        Item {   // xícara + patinhas + vapor
            width: figure.width; height: figure.height
            transform: [
                Rotation { origin.x: capy.cupCenter[0] * capy.s; origin.y: capy.cupCenter[1] * capy.s; angle: -16 * capy.sip },
                Translate { x: 5 * capy.sip * capy.s; y: -16 * capy.sip * capy.s }
            ]
            Layer { name: "cup" }
            Full { source: "assets/steam-" + capy.steamFrame + ".png"; opacity: Math.max(0, 1 - capy.sip * 1.6) }
        }
    }
}
