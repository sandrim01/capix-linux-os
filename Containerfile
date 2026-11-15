# Capix Linux OS — imagem do sistema (bootc / Fedora Kinoite)
# Sistema base somente-leitura, atualizações atômicas com rollback — a mesma ideia do FydeOS.
ARG FEDORA_VERSION=44
FROM quay.io/fedora/fedora-kinoite:${FEDORA_VERSION}
ARG FEDORA_VERSION=44

# Edição do Capix: "desktop" (uso geral, com modo gamer) ou "sec" (OSINT + pentest).
ARG CAPIX_EDITION=desktop

LABEL org.opencontainers.image.title="Capix Linux OS" \
      org.opencontainers.image.vendor="UnbugSTI (UnbugSolutions-TI)" \
      org.opencontainers.image.description="Linux com apps web, Android e Linux num desktop estilo Windows 10" \
      containers.bootc="1"

# 1) Pacotes: navegador, Android (Waydroid), splash, fontes
RUN dnf -y install \
        chromium \
        waydroid \
        plymouth-plugin-script \
        rsms-inter-fonts \
        kdialog \
        distrobox \
        cage \
        clamav clamav-update \
        libnotify \
        python3-dbus \
        rsync usbguard \
        cups cups-filters ipp-usb plasma-print-manager sddm \
        sane-backends sane-airscan skanpage avahi nss-mdns \
    && (dnf -y remove firefox firefox-langpacks || true) \
    && dnf clean all

# 1a) Pacotes específicos da edição
#   - desktop: modo gamer (GameMode/Gamescope/MangoHud)
#   - sec: ferramentas de OSINT/pentest + utilitários de rede
RUN set -eux; \
    if [ "$CAPIX_EDITION" = "desktop" ]; then \
        dnf -y install gamemode gamescope mangohud bind-utils; \
    elif [ "$CAPIX_EDITION" = "sec" ]; then \
        dnf -y install --skip-unavailable \
            nmap nmap-ncat tcpdump wireshark-cli whois bind-utils \
            perl-Image-ExifTool masscan \
            john hydra hashcat sqlmap nikto aircrack-ng \
            radare2 binwalk foremost openssl \
            git python3-pip jq; \
    fi; \
    dnf clean all

# 1b) Placas de vídeo AMD e Intel: drivers open source (Mesa), Vulkan 64 e 32 bits
#     (jogos e Proton), decodificação de vídeo (VA-API) e utilitários.
RUN dnf -y install \
        mesa-dri-drivers mesa-vulkan-drivers mesa-va-drivers \
        mesa-dri-drivers.i686 mesa-vulkan-drivers.i686 \
        vulkan-loader vulkan-loader.i686 vulkan-tools \
        libva-utils \
        radeontop intel-gpu-tools \
        glxinfo clinfo \
    && dnf clean all

# 2) Arquivos do Capix (tema de login, splash, layout Win10, wallpapers, serviços)
COPY rootfs/ /

# 2a) Aplica a edição: grava o marcador e remove o que não pertence a ela
RUN set -eux; \
    mkdir -p /usr/share/capix; printf '%s\n' "${CAPIX_EDITION}" > /usr/share/capix/edition; \
    if [ "$CAPIX_EDITION" = "desktop" ]; then \
        rm -f /usr/libexec/capix/faro-server.py /usr/bin/capix-faro \
              /usr/libexec/capix/capix-pentest \
              /usr/share/applications/capix-faro.desktop; \
        rm -rf /usr/share/capix/faro; \
    fi; \
    if [ "$CAPIX_EDITION" = "sec" ]; then \
        rm -f /usr/libexec/capix/gamer-session /usr/libexec/capix/gamer-dnd \
              /usr/share/wayland-sessions/capix-gamer.desktop 2>/dev/null || true; \
    fi

# 2b) Tela de login: deixa só duas opções de sessão —
#     "Capix (sistema normal)" (Plasma Wayland) e "Capix Gamer" (modo console).
#     Remove Plasma X11, kiosk e quaisquer outras sessões do seletor de login.
RUN set -eux; \
    for d in /usr/share/wayland-sessions /usr/share/xsessions; do \
        [ -d "$d" ] || continue; \
        for f in "$d"/*.desktop; do \
            [ -e "$f" ] || continue; \
            case "$(basename "$f")" in \
                plasma.desktop|capix-gamer.desktop) : ;; \
                *) rm -f "$f" ;; \
            esac; \
        done; \
    done; \
    # Renomeia a sessão Plasma para aparecer como "Capix (sistema normal)" no login
    if [ -f /usr/share/wayland-sessions/plasma.desktop ]; then \
        sed -i '/^Name\[/d' /usr/share/wayland-sessions/plasma.desktop; \
        sed -i 's/^Name=.*/Name=Capix (sistema normal)/' /usr/share/wayland-sessions/plasma.desktop; \
    fi

# 3) Identidade, aparência e serviços
RUN set -eux; \
    sed -i \
      -e 's/^NAME=.*/NAME="Capix Linux OS"/' \
      -e "s/^PRETTY_NAME=.*/PRETTY_NAME=\"Capix Linux OS ${FEDORA_VERSION}\"/" \
      -e 's/^LOGO=.*/LOGO=capix-logo/' \
      /usr/lib/os-release; \
    grep -q '^LOGO=' /usr/lib/os-release || echo 'LOGO=capix-logo' >> /usr/lib/os-release; \
    sed -i '/^VENDOR_NAME=/d' /usr/lib/os-release; echo 'VENDOR_NAME="UnbugSTI (UnbugSolutions-TI)"' >> /usr/lib/os-release; \
    mkdir -p /usr/share/capix; echo open > /usr/share/capix/gpu-variant; \
    # Faz o Plasma usar o visual Capix (o Fedora define o próprio em kde-settings)
    find /usr/share/kde-settings /etc/xdg -name kdeglobals -exec \
      sed -i 's/^LookAndFeelPackage=.*/LookAndFeelPackage=org.capix.desktop/' {} + 2>/dev/null || true; \
    gtk-update-icon-cache -f /usr/share/icons/hicolor || true; \
    plymouth-set-default-theme capix; \
    systemctl enable cups.socket avahi-daemon.service ipp-usb.service; \
    systemctl enable capix-flathub.service capix-first-apps.service capix-update.timer \
                     capix-antivirus.timer clamav-freshclam.service firewalld.service; \
    # Usa o SDDM como gerenciador de login (necessário para o tema capix da capivara).
    # O Kinoite pode vir com o plasma-login-greeter ativo; forçamos o SDDM.
    systemctl disable plasma-login-greeter.service plasma-login.service 2>/dev/null || true; \
    if [ -f /usr/lib/systemd/system/sddm.service ]; then \
        systemctl enable sddm.service 2>/dev/null || true; \
        ln -sf /usr/lib/systemd/system/sddm.service /etc/systemd/system/display-manager.service; \
    fi; \
    # ClamAV: permite rodar a atualização de definições (o Fedora vem com "Example" no arquivo)
    sed -i 's/^Example/#Example/' /etc/freshclam.conf 2>/dev/null || true; \
    chmod 0755 /usr/libexec/capix/* /usr/bin/capix-*; \
    # O Capix aplica updates no próximo boot, sem reiniciar sozinho
    systemctl disable bootc-fetch-apply-updates.timer rpm-ostreed-automatic.timer 2>/dev/null || true

# 4) Regenera o initramfs para incluir o splash da capivara
RUN set -eux; \
    KVER="$(ls /usr/lib/modules | sort -V | tail -n1)"; \
    dracut --no-hostonly --kver "$KVER" --reproducible --zstd --add ostree \
           -f "/usr/lib/modules/$KVER/initramfs.img"; \
    chmod 0600 "/usr/lib/modules/$KVER/initramfs.img"

RUN bootc container lint
