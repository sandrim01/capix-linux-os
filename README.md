# Capix Linux OS 🌿

**Desenvolvido por UnbugSTI (UnbugSolutions-TI)**

Um Linux para o dia a dia com a mesma ideia do FydeOS: apps **web**, **Android** e **Linux** lado a lado, sistema protegido contra alterações e atualizações automáticas. A cara é de **Windows 10**, e a mascote é uma capivara.

- **Boot:** a própria logo (sem redesenho) mastigando um matinho e piscando, com o spinner de pontinhos do Windows 10. A logo é recortada em camadas (queixo e olhos) por `tools/split-logo.py`; só o matinho é acrescentado.
- **Login:** a capivara do cafezinho (o desenho de `art/capivara-cafe-original.png`), recortada em camadas e animada:
  - quando você digita o **nome de usuário**, ela abre o olhinho e acompanha o cursor do texto;
  - quando você digita a **senha**, ela abaixa a cabeça, leva a xícara à boca e toma um gole de olhos fechados (se você clicar em 👁 para mostrar a senha, ela abre o olho e espia por cima da xícara);
  - se a **senha estiver errada**, ela baixa a xícara, faz carinha triste e balança a cabeça dizendo "não";
  - quando o login dá certo, ela fecha os olhos e cora;
  - o vapor do café sobe o tempo todo e ela respira devagarinho.
  - Para trocar por uma versão do desenho em alta resolução: limpe o fundo, rode `python3 tools/split-drawing.py desenho-3x.png art/capivara-cafe` e ajuste os polígonos da cabeça e da xícara no script se a pose mudar.

## Equivalência com o FydeOS

| FydeOS | Capix Linux OS |
|---|---|
| Base Chromium OS | Fedora Kinoite (KDE Plasma 6), distribuída como imagem **bootc** |
| Arquivos do sistema somente-leitura | `/usr` somente-leitura (OSTree/composefs) |
| Atualizações automáticas em segundo plano | `capix-update.timer`: `bootc upgrade` + `flatpak update`, aplicados no próximo boot |
| Voltar para a versão anterior | `sudo bootc rollback` |
| Apps Android | Waydroid (`Apps Android` no menu; o primeiro uso baixa a imagem com ou sem Google Play) |
| Apps Linux | Flatpak + Flathub (Discover = "Loja Capix") e `distrobox`/`toolbox` para desenvolvimento |
| Apps web / PWA | Chromium com instalação de sites como apps |
| Criptografia | Opção de criptografar o disco no instalador (com o splash pedindo a senha) |
| Interface própria | Plasma com layout Windows 10: barra inferior, menu Iniciar com a capivara, bandeja, relógio, "mostrar área de trabalho" no canto |
| Painel do sistema | **Capix Central** (`Super+I`): atualizações e restauração, apps Android, apps recomendados, IA, segurança, papéis de parede, aparência, quiosque, sobre |
| Primeiros passos | Assistente de boas-vindas no primeiro login (Android, apps, atualizações) |
| Proteção contra vírus | ClamAV: definições atualizadas automaticamente + verificação semanal das pastas pessoais, com aviso na tela |
| FydeOS AI | Assistente de IA local e privado (Alpaca + Ollama, instalado com um clique) |
| Modo quiosque | Usuário restrito com login automático e uma página web em tela cheia (cage + Chromium) |
| Firewall | firewalld ativo por padrão |
| Backup | **Capix Backup**: cópias incrementais da pasta pessoal para um disco externo (rsync + hardlinks), automáticas todo dia, com várias versões guardadas. Página na Central: escolher destino, fazer agora, ligar/desligar o automático e ver as cópias |
| Privacidade | **Capix Privacidade**: importar e ligar VPN WireGuard, instalar cofre de senhas (KeePassXC/Bitwarden) e Tor Browser com um clique, firewall, proteção contra dispositivos USB desconhecidos (USBGuard) e triturador de arquivos |
| Impressoras e scanners | CUPS sem driver (IPP/AirPrint, USB via ipp-usb), descoberta na rede (Avahi), SANE + sane-airscan e o app Skanpage; página na Central |
| (extra) Perfis de trabalho | **Modo investigação**: liga a VPN escolhida (se não conectar, nada abre) e abre Faro, cofre de senhas, navegador descartável e/ou Tor; **modo pessoal** desfaz. **Navegador descartável**: Chromium com perfil temporário em memória, apagado ao fechar |
| Placas de vídeo | **AMD e Intel** de fábrica (Mesa, Vulkan 64/32 bits, decodificação de vídeo por hardware); **NVIDIA** numa imagem à parte (`capix-nvidia`) com o driver proprietário já embutido, já que o sistema base é somente-leitura. A Capix Central detecta a placa e mostra o comando de troca de imagem quando faz sentido |
| (extra) Capix Monitor | Widget na área de trabalho com todas as métricas: processador (total, por núcleo, frequência, temperatura), memória e swap, placa de vídeo (uso, temperatura, VRAM, consumo), discos (espaço, leitura/escrita, temperatura do SSD), rede, bateria, carga, tempo ligado e os processos que mais consomem. Dois cliques abrem o Monitor do Sistema completo |
| (extra) Capix Faro (OSINT) | Investigação de infraestrutura e ameaças: domínio (DNS, RDAP, subdomínios por Certificate Transparency, TLS, cabeçalhos de segurança, SPF/DMARC), IP (rede, DNS reverso, exposição via Shodan InternetDB), link suspeito (redirecionamentos e sinais de phishing), arquivo (hashes, tipo real, metadados, IOCs), hash (VirusTotal/MalwareBazaar com chave opcional), cabeçalho de e-mail (caminho, SPF/DKIM/DMARC, remetente falso), extrator de IOCs e casos com relatório em Markdown. Só fontes públicas e passivas |
| (extra) Marca d'água | "by UnbugSTI" no boot, na tela de bloqueio e de login, no canto da área de trabalho, no Capix Monitor, na Capix Central e no `/etc/os-release` (`VENDOR_NAME`) |
| (extra) Modo gamer | Na Capix Central: perfil de desempenho, "Não perturbe", atualizações e antivírus pausados; GameMode, MangoHud e gamescope instalados; plataformas (Steam, Heroic, Lutris, Bottles, RetroArch, Prism Launcher, Sober, Discord, ProtonUp-Qt) com um clique; jogos na nuvem (Xbox Cloud, GeForce NOW, Luna, Boosteroid); sessão **Capix Gamer** que abre direto na Steam em tela cheia (modo console) |

## Estrutura

```
art/logo-original.jpg     Logo original
art/logo-*.png            Camadas da logo para o boot (geradas por tools/split-logo.py)
art/logo-anim.js          Animação da logo mastigando (prévia e quadros do Plymouth)
art/capy-drawing.js       Animação da capivara do cafezinho (login)
art/capivara-cafe-*.png   Camadas do desenho: corpo, cabeça e xícara (geradas por tools/split-drawing.py)
art/wallpaper.svg         Papel de parede low-poly (gerado)
tools/render-assets.mjs   Gera os PNGs: quadros do Plymouth, camadas do login, ícones, wallpaper
tools/split-logo.py       Recorta a logo em camadas (queixo, olhos)
tools/split-drawing.py    Recorta o desenho da capivara do café em camadas (corpo, cabeça, xícara)
tools/build-preview.mjs   Gera preview/capix-preview.html (prévia interativa em arquivo único)
preview/src.html          Fonte da prévia (boot → bloqueio → login → área de trabalho)
Containerfile             Imagem do sistema (bootc)
build.sh                  Build da imagem, ISO ou VM
config/vm-user.toml       Usuário de teste para a VM
tools/wallpapers.mjs      Gera a coleção de papéis de parede em estilo anime (art/wallpapers/*.svg)
preview/central-mock.js   Simula o servidor da Capix Central dentro da prévia
.github/workflows/build.yml  Build diário da imagem e publicação no ghcr.io
rootfs/                   Tudo que é copiado para o sistema:
  usr/bin/capix-central                 Abre a Capix Central
  usr/libexec/capix/central-server.py   Servidor local da Central (só 127.0.0.1, com token)
  usr/libexec/capix/capix-admin         Ações de administrador (via pkexec; lista fechada de verbos)
  usr/share/capix/central/              Interface da Central (estilo Configurações do Windows 10)
  usr/share/capix/apps.list             Apps recomendados (e quais vêm instalados no 1º boot)
  usr/share/wallpapers/Capix-*/         Coleção de papéis de parede em estilo anime
  usr/share/polkit-1/actions/org.capix.admin.policy   Permissão de administrador da Central
  usr/libexec/capix/kiosk-session       Sessão do modo quiosque
  usr/libexec/capix/gamer-session       Sessão "Capix Gamer" (gamescope + Steam em tela cheia)
  usr/libexec/capix/capix-backup         Cópias de segurança da pasta pessoal (rsync incremental)
  usr/lib/systemd/user/capix-backup.*    Backup automático diário (timer de usuário)
  usr/bin/capix-faro + usr/libexec/capix/faro-server.py + usr/share/capix/faro/   Capix Faro (OSINT)
  usr/libexec/capix/sysmetrics          Coletor de métricas do computador (JSON) usado pelo Capix Monitor
  usr/share/plasma/plasmoids/org.capix.monitor/    Widget Capix Monitor
  usr/share/plasma/plasmoids/org.capix.watermark/  Marca d'água "by UnbugSTI" na área de trabalho
  usr/libexec/capix/gamer-dnd           "Não perturbe" enquanto o modo gamer está ligado
  usr/share/sddm/themes/capix/         Tela de login (QML/Qt 6): bloqueio + capivara do cafezinho
  usr/share/plymouth/themes/capix/     Splash de boot: a logo mastigando o matinho (24 quadros)
  usr/share/plasma/look-and-feel/org.capix.desktop/   Layout e visual estilo Windows 10
  usr/share/wallpapers/Capix/          Papel de parede
  usr/bin/capix-android                Abre os apps Android (configura o Waydroid na 1ª vez)
  usr/lib/systemd/system/capix-*       Flathub, apps do 1º boot, atualizações, antivírus
  etc/sddm.conf.d, etc/xdg/kdeglobals  Ativa o tema de login e o visual Capix
  etc/xdg/kglobalshortcutsrc            Atalhos estilo Windows (Super+I = Central, Ctrl+Alt+T = terminal)
  etc/xdg/autostart/capix-welcome.desktop  Assistente no primeiro login
```

## Como gerar

Num Fedora (ou outro Linux com podman):

```bash
sudo dnf install podman nodejs librsvg2-tools ImageMagick python3-opencv
./build.sh preview   # só a prévia em HTML
./build.sh vm        # imagem + disco qcow2 em ./output (usuário capix / senha capix)
./build.sh iso       # imagem + ISO instalável em ./output
```

Para testar a VM: `virt-install` ou GNOME Boxes/virt-manager apontando para `output/qcow2/disk.qcow2`.

Mudar a versão do Fedora de base: `FEDORA_VERSION=45 ./build.sh iso`.

Placa de vídeo: por padrão a imagem atende AMD e Intel. Para embutir o driver NVIDIA, use `CAPIX_GPU=nvidia ./build.sh iso` (gera a imagem `capix-nvidia` a partir de `Containerfile.nvidia`). Numa máquina já instalada, troque com `sudo bootc switch ghcr.io/SEU_USUARIO/capix-nvidia:44`. O build no GitHub publica as duas imagens (`capix` e `capix-nvidia`).

### Atualizações automáticas nas máquinas instaladas

1. Suba o projeto num repositório do GitHub. O workflow `.github/workflows/build.yml` constrói a imagem todo dia e publica em `ghcr.io/SEU_USUARIO/capix:44` (deixe o pacote público nas configurações do GitHub).
2. Gere a ISO a partir da imagem publicada, para que as máquinas instaladas sigam esse endereço:
   `CAPIX_IMAGE=ghcr.io/SEU_USUARIO/capix:44 ./build.sh iso`
3. Numa máquina já instalada a partir de uma imagem local: `sudo bootc switch ghcr.io/SEU_USUARIO/capix:44`.

### Testar a Capix Central sem instalar

```bash
R=$PWD/rootfs
CAPIX_DRYRUN=1 CAPIX_WEB=$R/usr/share/capix/central CAPIX_ADMIN=$R/usr/libexec/capix/capix-admin \
CAPIX_APPS=$R/usr/share/capix/apps.list CAPIX_WALLS=$R/usr/share/capix/wallpapers.json \
python3 $R/usr/libexec/capix/central-server.py --no-browser
# abra no navegador o endereço que aparecer (inclui um token de acesso)
```

Em modo simulação nada é alterado: as ações só mostram os comandos que seriam executados.

Para trocar a logo: substitua `art/logo-original.jpg`, rode `python3 tools/split-logo.py art/logo-original.jpg art/` (ajuste as coordenadas do queixo e dos olhos no script se o desenho mudar) e depois `./build.sh preview`.

## Estado atual (leia antes de gravar num pendrive)

O que foi testado:
- A arte e a prévia (renderização, animação de boot, o rastreamento do cursor, o gole de café, o balançar de cabeça, a área de trabalho de demonstração).
- A Capix Central em modo simulação: todas as páginas, o assistente de boas-vindas e a galeria de papéis de parede; as proteções do servidor (sem token → 403, Host diferente → 403, ação desconhecida recusada) e do `capix-admin` (apps fora da lista, endereço de quiosque com caracteres perigosos e verbos desconhecidos são recusados).

O que **ainda não foi testado num build real**:
- `Containerfile` e `build.sh`: os nomes de pacotes (`chromium`, `waydroid`, `rsms-inter-fonts`, `plymouth-plugin-script`) e as opções do `bootc-image-builder` seguem o Fedora atual, mas precisam de um primeiro build para confirmar.
- Tema do SDDM (`Main.qml`/`Capybara.qml`): é a mesma lógica da prévia portada para QML, mas não foi executado num SDDM. Teste rápido sem reiniciar: `sddm-greeter-qt6 --test-mode --theme /usr/share/sddm/themes/capix`.
- Script do Plymouth: teste com `sudo plymouthd; sudo plymouth --show-splash; sleep 8; sudo plymouth quit`.
- Layout do Plasma: vale para usuários **novos**; num usuário que já existe, aplique em Configurações → Aparência → Capix.
- Capix Backup: o helper (snapshots incrementais, retenção, status) foi testado com rsync real; a página e o timer de usuário rodam em simulação. Privacidade: a página e a validação dos comandos (VPN, USBGuard) foram testadas; a importação/ligação de VPN WireGuard e o USBGuard só podem ser confirmados num sistema real com rede.
- Capix Faro: os analisadores locais (e-mail, arquivo, IOCs, casos) e as proteções do servidor foram testados; as consultas na internet (DNS, RDAP, crt.sh, InternetDB, VirusTotal, abuse.ch) só podem ser confirmadas com rede.
- Ações reais da Central (pkexec, bootc, waydroid, flatpak, ClamAV, quiosque com cage) e o workflow do GitHub: escritos para o Fedora atual, precisam do primeiro build para confirmar.

## Próximos passos sugeridos

1. Primeiro build em VM e ajustes finos (é aqui que aparecem os detalhes de pacote e de tema).
2. Desenho da capivara do café e da logo em alta resolução.
3. Tema de ícones e de cursor próprios.
4. Gerenciamento central de várias máquinas (equivalente ao FydeOS for Enterprise).
