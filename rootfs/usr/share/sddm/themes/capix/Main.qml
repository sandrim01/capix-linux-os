// Capix Linux OS — tema de login do SDDM (Qt 6 / SDDM >= 0.21)
// Tela de bloqueio estilo Windows 10 + login com a capivara interativa.
import QtQuick 2.15
import QtQuick.Effects

Rectangle {
    id: root
    width: 1920; height: 1080
    color: "#121214"

    readonly property color cream: "#F2F2F2"
    readonly property color orange: "#F68B2C"
    readonly property string fontName: config.fontFamily || "Inter"
    property int sessionIndex: sessionModel.lastIndex
    property bool locked: true

    // ---------- Fundo ----------
    Image {
        id: bg
        anchors.fill: parent
        source: config.background || "assets/background.png"
        fillMode: Image.PreserveAspectCrop
        visible: false
    }
    MultiEffect {
        anchors.fill: parent
        source: bg
        blurEnabled: !root.locked
        blur: root.locked ? 0 : 1.0
        blurMax: 64
        brightness: root.locked ? 0 : -0.25
        Behavior on blur { NumberAnimation { duration: 350 } }
        Behavior on brightness { NumberAnimation { duration: 350 } }
    }

    function unlock() {
        if (!locked) return
        locked = false
        if (userInput.text.length > 0) passInput.forceActiveFocus()
        else userInput.forceActiveFocus()
    }

    // ---------- Login ----------
    Item {
        id: loginPane
        anchors.fill: parent
        opacity: root.locked ? 0 : 1
        Behavior on opacity { NumberAnimation { duration: 350 } }

        MouseArea {
            id: tracker
            anchors.fill: parent
            hoverEnabled: true
            acceptedButtons: Qt.NoButton
        }

        Column {
            id: box
            width: 340
            spacing: 10
            anchors.centerIn: parent
            anchors.verticalCenterOffset: -40

            Item {
                id: avatar
                width: 300; height: 250
                anchors.horizontalCenter: parent.horizontalCenter
                clip: true
                // brilho quentinho atrás da capivara
                Rectangle {
                    width: 240; height: 240; radius: 120
                    anchors.centerIn: parent; anchors.verticalCenterOffset: 20
                    gradient: Gradient {
                        GradientStop { position: 0.0; color: Qt.rgba(1, 1, 1, 0.12) }
                        GradientStop { position: 1.0; color: "transparent" }
                    }
                }
                Capybara {
                    id: capy
                    width: 232; height: 300
                    anchors.horizontalCenter: parent.horizontalCenter
                    y: 6
                    caret: userInput.text.length === 0 ? 0.05
                         : Math.max(0, Math.min(1, (userInput.cursorRectangle.x + 12) / userField.width))
                    mouseDX: tracker.containsMouse ? (tracker.mouseX - root.width / 2) / root.width : 0
                    mouseDY: tracker.containsMouse ? (tracker.mouseY - (box.y + 90)) / root.height : 0
                    mode: loginOk ? "happy"
                        : passInput.activeFocus ? (passInput.echoMode === TextInput.Normal ? "peek" : "pass")
                        : userInput.activeFocus ? "user" : "idle"
                    property bool loginOk: false
                }
            }

            Text {
                width: parent.width
                horizontalAlignment: Text.AlignHCenter
                elide: Text.ElideRight
                text: userInput.text.length ? "Olá, " + userInput.text + "!" : "Olá!"
                color: root.cream
                font.family: root.fontName; font.pixelSize: 30; font.weight: Font.Light
                topPadding: 8; bottomPadding: 8
            }

            // Campo de usuário
            Rectangle {
                id: userField
                width: parent.width; height: 40; radius: 2
                color: userInput.activeFocus ? "white" : Qt.rgba(1, 1, 1, 0.9)
                border.width: 2; border.color: userInput.activeFocus ? root.orange : "transparent"
                TextInput {
                    id: userInput
                    anchors.fill: parent; anchors.leftMargin: 12; anchors.rightMargin: 12
                    verticalAlignment: TextInput.AlignVCenter
                    font.family: root.fontName; font.pixelSize: 15
                    color: "#1b120d"; selectionColor: root.orange
                    clip: true
                    text: userModel.lastUser
                    KeyNavigation.tab: passInput
                    onAccepted: passInput.forceActiveFocus()
                    Text {
                        anchors.verticalCenter: parent.verticalCenter
                        text: "Nome de usuário"; color: "#6d5a4d"
                        font: userInput.font
                        visible: userInput.text.length === 0
                    }
                }
            }

            // Campo de senha
            Rectangle {
                id: passField
                width: parent.width; height: 40; radius: 2
                color: passInput.activeFocus ? "white" : Qt.rgba(1, 1, 1, 0.9)
                border.width: 2; border.color: passInput.activeFocus ? root.orange : "transparent"
                TextInput {
                    id: passInput
                    anchors.fill: parent; anchors.leftMargin: 12; anchors.rightMargin: 84
                    verticalAlignment: TextInput.AlignVCenter
                    font.family: root.fontName; font.pixelSize: 15
                    color: "#1b120d"; selectionColor: root.orange
                    echoMode: TextInput.Password
                    passwordCharacter: "●"
                    clip: true
                    KeyNavigation.backtab: userInput
                    onAccepted: root.doLogin()
                    Text {
                        anchors.verticalCenter: parent.verticalCenter
                        text: "Senha"; color: "#6d5a4d"
                        font: passInput.font
                        visible: passInput.text.length === 0
                    }
                }
                // mostrar/ocultar senha
                Rectangle {
                    width: 36; height: 36; x: parent.width - 76; y: 2; color: "transparent"
                    Text { anchors.centerIn: parent; text: passInput.echoMode === TextInput.Password ? "👁" : "🙈"; font.pixelSize: 16; color: "#6d5a4d" }
                    MouseArea {
                        anchors.fill: parent; cursorShape: Qt.PointingHandCursor
                        onClicked: {
                            passInput.echoMode = passInput.echoMode === TextInput.Password ? TextInput.Normal : TextInput.Password
                            passInput.forceActiveFocus()
                        }
                    }
                }
                // botão entrar
                Rectangle {
                    width: 36; height: 36; x: parent.width - 38; y: 2
                    color: goArea.containsMouse ? "#FF9B40" : root.orange
                    Text { anchors.centerIn: parent; text: "→"; color: "white"; font.pixelSize: 20; font.bold: true }
                    MouseArea { id: goArea; anchors.fill: parent; hoverEnabled: true; cursorShape: Qt.PointingHandCursor; onClicked: root.doLogin() }
                }
                SequentialAnimation {
                    id: fieldShake
                    NumberAnimation { target: passField; property: "x"; to: -7; duration: 50 }
                    NumberAnimation { target: passField; property: "x"; to: 7;  duration: 50 }
                    NumberAnimation { target: passField; property: "x"; to: -5; duration: 50 }
                    NumberAnimation { target: passField; property: "x"; to: 5;  duration: 50 }
                    NumberAnimation { target: passField; property: "x"; to: 0;  duration: 50 }
                }
            }

            Text {
                id: message
                width: parent.width
                horizontalAlignment: Text.AlignHCenter
                color: "#FFD2B8"
                font.family: root.fontName; font.pixelSize: 13
                text: ""
            }
        }

        // Canto inferior direito: sessão, idioma, energia
        Row {
            anchors.right: parent.right; anchors.bottom: parent.bottom
            anchors.margins: 20
            spacing: 6
            // nomes das sessões (Plasma, Capix Gamer...) para mostrar no botão
            Repeater { id: sessRep; model: sessionModel; delegate: Item { visible: false; property string sname: model.name } }
            CornerButton {
                label: sessRep.count > 0 && sessRep.itemAt(root.sessionIndex) ? sessRep.itemAt(root.sessionIndex).sname : "Sessão"
                visible: sessRep.count > 1
                onClicked: root.sessionIndex = (root.sessionIndex + 1) % sessRep.count
            }
            CornerButton { label: (typeof keyboard !== "undefined" && keyboard.layouts && keyboard.layouts.length) ? String(keyboard.layouts[keyboard.currentLayout].shortName).toUpperCase() : "POR" }
            CornerButton { label: "⟳"; visible: sddm.canReboot; onClicked: sddm.reboot() }
            CornerButton { label: "⏻"; visible: sddm.canPowerOff; onClicked: sddm.powerOff() }
        }
    }

    // ---------- Tela de bloqueio (estilo Windows 10) ----------
    Item {
        id: lockPane
        width: parent.width; height: parent.height
        y: root.locked ? 0 : -height
        Behavior on y { NumberAnimation { duration: 450; easing.type: Easing.OutCubic } }

        Column {
            anchors.left: parent.left; anchors.bottom: parent.bottom
            anchors.leftMargin: parent.width * 0.05; anchors.bottomMargin: Math.max(60, parent.height * 0.09)
            Text {
                id: lockTime
                color: root.cream; font.family: root.fontName; font.pixelSize: Math.min(128, root.height * 0.13); font.weight: Font.Light
            }
            Text {
                id: lockDate
                color: root.cream; font.family: root.fontName; font.pixelSize: Math.min(36, root.height * 0.036)
            }
        }
        Timer {
            interval: 1000; running: true; repeat: true; triggeredOnStart: true
            onTriggered: {
                var d = new Date()
                lockTime.text = Qt.formatTime(d, "HH:mm")
                var s = d.toLocaleDateString(Qt.locale("pt_BR"), "dddd, d 'de' MMMM")
                lockDate.text = s.charAt(0).toUpperCase() + s.slice(1)
            }
        }
        MouseArea { anchors.fill: parent; enabled: root.locked; onClicked: root.unlock() }
    }

    // marca d'água da desenvolvedora (aparece no bloqueio e no login)
    Text {
        anchors.left: parent.left; anchors.bottom: parent.bottom
        anchors.leftMargin: 22; anchors.bottomMargin: 18
        text: "Capix Linux OS · by UnbugSTI"
        color: root.cream; opacity: 0.45
        font.family: root.fontName; font.pixelSize: 12; font.letterSpacing: 0.5
        z: 10
    }

    focus: true
    Keys.onPressed: function(event) { if (root.locked) { root.unlock(); event.accepted = true } }

    // ---------- Autenticação ----------
    function doLogin() {
        if (userInput.text.length === 0) { message.text = "Digite seu nome de usuário."; userInput.forceActiveFocus(); return }
        message.color = root.cream
        message.text = "Verificando…"
        sddm.login(userInput.text, passInput.text, root.sessionIndex)
    }

    Connections {
        target: sddm
        function onLoginFailed() {
            message.color = "#FFD2B8"
            message.text = "Senha incorreta. Tente novamente."
            capy.shake()          // a capivara balança a cabeça: "não!"
            fieldShake.restart()
            passInput.selectAll()
            passInput.forceActiveFocus()
        }
        function onLoginSucceeded() {
            capy.loginOk = true
            message.text = "Bem-vindo(a)!"
        }
    }

    component CornerButton: Rectangle {
        id: cb
        property string label: ""
        signal clicked()
        width: Math.max(40, t.implicitWidth + 16); height: 40; radius: 2
        color: ma.containsMouse ? Qt.rgba(1, 1, 1, 0.12) : "transparent"
        Text { id: t; anchors.centerIn: parent; text: cb.label; color: root.cream; font.family: root.fontName; font.pixelSize: cb.label.length > 2 ? 12 : 18 }
        MouseArea { id: ma; anchors.fill: parent; hoverEnabled: true; cursorShape: Qt.PointingHandCursor; onClicked: cb.clicked() }
    }
}
