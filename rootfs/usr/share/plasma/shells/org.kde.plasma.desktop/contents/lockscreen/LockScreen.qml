// Capix Linux OS — tela de bloqueio do Plasma 6 (kscreenlocker)
// Mesma identidade da tela de login (SDDM): bloqueio estilo Windows 10 + capivara do cafezinho.
import QtQuick 2.15

Rectangle {
    id: root
    implicitWidth: 1920; implicitHeight: 1080
    color: "#121214"

    // Propriedades e sinais esperados pelo kscreenlocker_greet (Plasma 6)
    property bool locked: false
    property bool viewVisible: false
    property bool suspendToRamSupported: false
    property bool suspendToDiskSupported: false
    signal suspendToRam()
    signal suspendToDisk()

    readonly property color cream: "#F2F2F2"
    readonly property color orange: "#F68B2C"
    readonly property string fontName: (typeof config !== "undefined" && config && config.fontFamily) ? config.fontFamily : "Inter"
    readonly property string displayName: (typeof kscreenlocker_userName !== "undefined" && kscreenlocker_userName) ? kscreenlocker_userName : ""

    property bool showLogin: false
    property string pendingPassword: ""

    onViewVisibleChanged: {
        if (viewVisible) {
            if (showLogin) passInput.forceActiveFocus()
            else root.forceActiveFocus()
        }
    }

    // ---------- Fundo ----------
    Image {
        id: bg
        anchors.fill: parent
        source: "assets/background.png"
        fillMode: Image.PreserveAspectCrop
    }
    Rectangle {
        anchors.fill: parent
        color: "black"
        opacity: root.showLogin ? 0.35 : 0
        Behavior on opacity { NumberAnimation { duration: 350 } }
    }

    function revealLogin(initialText) {
        if (!showLogin) {
            showLogin = true
            if (typeof authenticator !== "undefined" && authenticator) {
                authenticator.startAuthenticating()
            }
        }
        if (initialText && initialText.length > 0 && !capy.loginOk) {
            passInput.text += initialText
            passInput.cursorPosition = passInput.text.length
        }
        passInput.forceActiveFocus()
        idleTimer.restart()
    }

    function hideLogin() {
        if (!showLogin) return
        showLogin = false
        pendingPassword = ""
        passInput.text = ""
        passInput.echoMode = TextInput.Password
        message.text = ""
        idleTimer.stop()
        if (typeof authenticator !== "undefined" && authenticator) {
            authenticator.stopAuthenticating()
        }
        root.forceActiveFocus()
    }

    function submitPassword() {
        if (typeof authenticator === "undefined" || !authenticator) return
        if (capy.loginOk) return
        message.color = root.cream
        message.text = "Verificando…"
        idleTimer.stop()
        if (authenticator.pamTimeout === true) {
            pendingPassword = passInput.text
            return
        }
        authenticator.respond(passInput.text)
    }

    // Mantém o PAM ativo enquanto o campo de senha está visível (como no LockScreenUi oficial)
    Timer {
        interval: 1000
        running: root.showLogin && (typeof authenticator !== "undefined" && authenticator && !authenticator.unlocked)
        repeat: true
        onTriggered: authenticator.startAuthenticating()
    }

    // Volta para a cortina de relógio após inatividade sem senha digitada
    Timer {
        id: idleTimer
        interval: 20000
        onTriggered: {
            if (root.showLogin && passInput.text.length === 0 && !capy.loginOk && root.pendingPassword.length === 0) {
                root.hideLogin()
            }
        }
    }

    Timer {
        id: unlockTimer
        interval: 220
        onTriggered: Qt.quit()
    }

    // ---------- Painel de desbloqueio (capivara do cafezinho) ----------
    Item {
        id: loginPane
        anchors.fill: parent
        opacity: root.showLogin ? 1 : 0
        visible: opacity > 0
        Behavior on opacity { NumberAnimation { duration: 350 } }

        MouseArea {
            id: tracker
            anchors.fill: parent
            hoverEnabled: true
            acceptedButtons: Qt.NoButton
            onPositionChanged: if (root.showLogin) idleTimer.restart()
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
                    caret: 0.5
                    mouseDX: tracker.containsMouse ? (tracker.mouseX - root.width / 2) / root.width : 0
                    mouseDY: tracker.containsMouse ? (tracker.mouseY - (box.y + 90)) / root.height : 0
                    mode: loginOk ? "happy"
                        : (passInput.activeFocus && passInput.text.length > 0)
                            ? (passInput.echoMode === TextInput.Normal ? "peek" : "pass")
                        : "idle"
                    property bool loginOk: false
                }
            }

            Text {
                width: parent.width
                horizontalAlignment: Text.AlignHCenter
                elide: Text.ElideRight
                text: root.displayName.length ? "Olá, " + root.displayName + "!" : "Olá!"
                color: root.cream
                font.family: root.fontName; font.pixelSize: 30; font.weight: Font.Light
                topPadding: 8; bottomPadding: 8
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
                    onTextChanged: if (root.showLogin) idleTimer.restart()
                    onAccepted: root.submitPassword()
                    Keys.onEscapePressed: root.hideLogin()
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
                    MouseArea { id: goArea; anchors.fill: parent; hoverEnabled: true; cursorShape: Qt.PointingHandCursor; onClicked: root.submitPassword() }
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
                wrapMode: Text.WordWrap
                color: "#FFD2B8"
                font.family: root.fontName; font.pixelSize: 13
                text: ""
            }
        }

        // Canto inferior direito: voltar ao bloqueio e suspender
        Row {
            anchors.right: parent.right; anchors.bottom: parent.bottom
            anchors.margins: 20
            spacing: 6
            CornerButton { label: "☾"; visible: root.suspendToRamSupported; onClicked: root.suspendToRam() }
            CornerButton { label: "↑"; onClicked: root.hideLogin() }
        }
    }

    // ---------- Cortina de bloqueio (estilo Windows 10) ----------
    Item {
        id: lockPane
        width: parent.width; height: parent.height
        y: root.showLogin ? -height : 0
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
        MouseArea {
            anchors.fill: parent
            enabled: !root.showLogin
            onClicked: root.revealLogin("")
        }
    }

    // marca d'água da desenvolvedora (aparece no bloqueio e no desbloqueio)
    Text {
        anchors.left: parent.left; anchors.bottom: parent.bottom
        anchors.leftMargin: 22; anchors.bottomMargin: 18
        text: "Capix Linux OS · by UnbugSTI"
        color: root.cream; opacity: 0.45
        font.family: root.fontName; font.pixelSize: 12; font.letterSpacing: 0.5
        z: 10
    }

    focus: true
    Keys.onPressed: function(event) {
        if (event.key === Qt.Key_Escape) {
            if (root.showLogin) {
                root.hideLogin()
                event.accepted = true
            }
            return
        }
        var printable = event.text && event.text.length === 1 && event.text >= " "
                        && !(event.modifiers & (Qt.ControlModifier | Qt.AltModifier | Qt.MetaModifier))
        if (!root.showLogin) {
            root.revealLogin(printable ? event.text : "")
            event.accepted = true
        } else if (!passInput.activeFocus) {
            passInput.forceActiveFocus()
            if (printable && !capy.loginOk) {
                passInput.text += event.text
                passInput.cursorPosition = passInput.text.length
                event.accepted = true
            }
        }
    }

    // ---------- Autenticação (PAM via kscreenlocker) ----------
    Connections {
        target: (typeof authenticator !== "undefined") ? authenticator : null
        ignoreUnknownSignals: true

        function onFailed(kind) {
            if (kind !== undefined && kind !== 0) return
            root.pendingPassword = ""
            message.color = "#FFD2B8"
            message.text = "Senha incorreta. Tente novamente."
            capy.shake()
            fieldShake.restart()
            passInput.text = ""
            passInput.forceActiveFocus()
            authenticator.startAuthenticating()
            idleTimer.restart()
        }

        function onSucceeded() {
            authenticator.stopAuthenticating()
            capy.loginOk = true
            message.color = root.cream
            message.text = "Bem-vindo(a)!"
            if (!root.showLogin) {
                Qt.quit()
            } else {
                unlockTimer.restart()
            }
        }

        function onPromptForSecretChanged() {
            if (root.showLogin) passInput.forceActiveFocus()
        }

        function onErrorMessageChanged() {
            if (authenticator.errorMessage) {
                message.color = "#FFD2B8"
                message.text = authenticator.errorMessage
                if (!root.showLogin) root.revealLogin("")
            }
        }

        function onInfoMessageChanged() {
            if (authenticator.infoMessage) {
                message.color = root.cream
                message.text = authenticator.infoMessage
            }
        }

        function onPamTimeoutChanged() {
            if (authenticator.pamTimeout === false && root.pendingPassword.length > 0) {
                var p = root.pendingPassword
                root.pendingPassword = ""
                authenticator.respond(p)
            }
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
