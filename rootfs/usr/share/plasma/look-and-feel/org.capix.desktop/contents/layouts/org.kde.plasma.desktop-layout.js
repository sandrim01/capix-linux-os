// Capix Linux OS — layout inicial estilo Windows 10 (Plasma 6)
// Barra inferior fixa: [Iniciar][apps fixados/abertos] ...... [bandeja][relógio][mostrar área de trabalho]

var panel = new Panel;
panel.location = "bottom";
panel.height = 2 * Math.ceil(gridUnit * 2.4 / 2);   // ~48 px, como no Windows 10
panel.floating = false;
panel.hiding = "none";
panel.lengthMode = "fill";

// Menu Iniciar com o ícone da capivara
var kickoff = panel.addWidget("org.kde.plasma.kickoff");
kickoff.currentConfigGroup = ["General"];
kickoff.writeConfig("icon", "capix-start");
kickoff.writeConfig("alphaSort", true);
kickoff.writeConfig("showActionButtonCaptions", false);

// Visão de tarefas (equivalente ao "Task View")
panel.addWidget("org.kde.plasma.pager");

// Barra de tarefas só com ícones, com apps fixados
var tasks = panel.addWidget("org.kde.plasma.icontasks");
tasks.currentConfigGroup = ["General"];
tasks.writeConfig("launchers", [
    "applications:chromium-browser.desktop",
    "applications:org.kde.dolphin.desktop",
    "applications:capix-android.desktop",
    "applications:org.kde.discover.desktop",
    "applications:org.kde.konsole.desktop"
].join(","));
tasks.writeConfig("indicateAudioStreams", true);

panel.addWidget("org.kde.plasma.marginsseparator");
panel.addWidget("org.kde.plasma.systemtray");

var clock = panel.addWidget("org.kde.plasma.digitalclock");
clock.currentConfigGroup = ["Appearance"];
clock.writeConfig("showDate", true);
clock.writeConfig("dateFormat", "shortDate");
clock.writeConfig("dateDisplayFormat", "BelowTime");

// "Mostrar área de trabalho" no cantinho direito, como no Windows 10
panel.addWidget("org.kde.plasma.showdesktop");

// Papel de parede Capix em todas as áreas de trabalho
var all = desktops();
for (var i = 0; i < all.length; i++) {
    var d = all[i];
    d.wallpaperPlugin = "org.kde.image";
    d.currentConfigGroup = ["Wallpaper", "org.kde.image", "General"];
    d.writeConfig("Image", "file:///usr/share/wallpapers/Capix/");
}

// Widget "Capix Monitor" no canto superior direito da tela principal
if (all.length > 0) {
    var desk = all[0];
    var geo = screenGeometry(desk.screen);
    var w = 330, h = 720;
    desk.addWidget("org.capix.monitor", geo.width - w - 24, 24, w, Math.min(h, geo.height - 120));
    // marca d'água da desenvolvedora, canto inferior direito (acima da barra de tarefas)
    desk.addWidget("org.capix.watermark", geo.width - 284, geo.height - 48 - 70, 260, 44);
}
