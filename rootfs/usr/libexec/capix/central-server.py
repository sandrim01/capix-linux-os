#!/usr/bin/env python3
"""
Capix Central — servidor local (só stdlib).

Segurança:
  * escuta apenas em 127.0.0.1, porta aleatória;
  * todo acesso (página e API) exige um token aleatório no caminho: /<token>/...
  * confere o cabeçalho Host (evita DNS rebinding) e só aceita JSON nas ações;
  * ações de administrador passam por pkexec + /usr/libexec/capix/capix-admin,
    que só aceita uma lista fechada de verbos.

Uso: central-server.py [--welcome] [--page <id>] [--no-browser] [--port N]
Variáveis: CAPIX_DRYRUN=1 (simula tudo, para testes), CAPIX_WEB=<pasta da interface>
"""
import argparse, http.server, json, os, platform, secrets, shutil, socket, subprocess
import sys, threading, time, urllib.parse

DRY = os.environ.get("CAPIX_DRYRUN") == "1"
WEB = os.environ.get("CAPIX_WEB", "/usr/share/capix/central")
ADMIN = os.environ.get("CAPIX_ADMIN", "/usr/libexec/capix/capix-admin")
APPS_LIST = os.environ.get("CAPIX_APPS", "/usr/share/capix/apps.list")
WALLS = os.environ.get("CAPIX_WALLS", "/usr/share/capix/wallpapers.json")
HOME = os.path.expanduser("~")
WELCOME_FLAG = os.path.join(HOME, ".config/capix/welcome-done")
GAMER_FLAG = os.path.join(HOME, ".config/capix/gamer-on")   # lido pelos serviços de atualização/antivírus

# Jogos na nuvem: abrem como app web (lista fechada)
CLOUD_GAMES = [
    {"id": "xcloud", "name": "Xbox Cloud Gaming", "desc": "Jogos do Game Pass Ultimate no navegador", "url": "https://www.xbox.com/play"},
    {"id": "geforcenow", "name": "GeForce NOW", "desc": "Seus jogos da Steam/Epic rodando nos servidores da NVIDIA", "url": "https://play.geforcenow.com"},
    {"id": "luna", "name": "Amazon Luna", "desc": "Jogos na nuvem da Amazon", "url": "https://luna.amazon.com"},
    {"id": "boosteroid", "name": "Boosteroid", "desc": "Jogos na nuvem com servidores no Brasil", "url": "https://cloud.boosteroid.com"},
]

TOKEN = secrets.token_urlsafe(24)
JOBS = {}
JOBS_LOCK = threading.Lock()

# ---------------------------------------------------------------- utilitários

def sh(*cmd, timeout=8):
    """Executa e devolve stdout (ou '' em erro)."""
    if DRY:
        return ""
    try:
        return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout).stdout.strip()
    except Exception:
        return ""


def read(path, default=""):
    try:
        with open(path) as f:
            return f.read()
    except Exception:
        return default


def os_release():
    d = {}
    for line in read("/etc/os-release").splitlines():
        if "=" in line:
            k, v = line.split("=", 1)
            d[k] = v.strip().strip('"')
    return d


def apps_catalog():
    out = []
    for line in read(APPS_LIST).splitlines():
        line = line.split("#", 1)[0].strip()
        if not line:
            continue
        p = [x.strip() for x in line.split("|")]
        if len(p) >= 5:
            out.append({"id": p[0], "name": p[1], "desc": p[2], "cat": p[3], "default": p[4] == "1"})
    return out

# ---------------------------------------------------------------- estado do sistema

def wallpapers():
    try:
        return json.loads(read(WALLS, "[]"))
    except Exception:
        return []


def current_wallpaper():
    cfg = read(os.path.join(HOME, ".config/plasma-org.kde.plasma.desktop-appletsrc"))
    for line in cfg.splitlines():
        if line.startswith("Image="):
            v = line.split("=", 1)[1]
            for w in wallpapers():
                if w["dir"].rstrip("/") in v:
                    return w["id"]
            return "custom"
    return "capix"


def status():
    if DRY:
        return mock_status()
    osr = os_release()
    st = {"os": {"name": osr.get("PRETTY_NAME", "Capix Linux OS"), "version": osr.get("VERSION_ID", "")}}

    # imagem do sistema (rpm-ostree funciona sem root)
    upd = {"booted": None, "staged": None, "rollback": None}
    try:
        j = json.loads(sh("rpm-ostree", "status", "--json") or "{}")
        for d in j.get("deployments", []):
            info = {"version": d.get("version") or "", "image": d.get("container-image-reference", ""),
                    "date": d.get("timestamp", 0)}
            if d.get("booted"):
                upd["booted"] = info
            elif d.get("staged"):
                upd["staged"] = info
            elif upd["booted"] and not upd["rollback"]:
                upd["rollback"] = info
    except Exception:
        pass
    upd["auto"] = sh("systemctl", "is-enabled", "capix-update.timer") == "enabled"
    upd["last_check"] = sh("systemctl", "show", "capix-update.service", "-p", "ExecMainExitTimestamp", "--value")
    st["updates"] = upd

    st["android"] = {
        "installed": shutil.which("waydroid") is not None,
        "initialized": os.path.exists("/var/lib/waydroid/waydroid.cfg"),
        "running": sh("systemctl", "is-active", "waydroid-container.service") == "active",
    }
    installed = set(sh("flatpak", "list", "--app", "--columns=application", timeout=15).split())
    st["apps"] = [dict(a, installed=a["id"] in installed) for a in apps_catalog()]

    av = {}
    try:
        av = json.loads(read("/var/lib/capix/av-last.json", "{}"))
    except Exception:
        pass
    av["running"] = sh("systemctl", "is-active", "capix-antivirus.service") == "activating"
    av["auto"] = sh("systemctl", "is-enabled", "capix-antivirus.timer") == "enabled"
    st["antivirus"] = av
    st["firewall"] = sh("systemctl", "is-active", "firewalld") == "active"

    kiosk_url = ""
    for line in read("/etc/capix/kiosk.conf").splitlines():
        if line.startswith("URL="):
            kiosk_url = line[4:].strip().strip('"')
    st["kiosk"] = {"enabled": os.path.exists("/etc/sddm.conf.d/90-capix-kiosk.conf"), "url": kiosk_url}

    scheme = ""
    for line in read(os.path.join(HOME, ".config/kdeglobals")).splitlines():
        if line.startswith("ColorScheme="):
            scheme = line.split("=", 1)[1]
    st["appearance"] = {"dark": "Light" not in scheme}

    mem = 0
    for line in read("/proc/meminfo").splitlines():
        if line.startswith("MemTotal:"):
            mem = int(line.split()[1]) * 1024
    cpu = ""
    for line in read("/proc/cpuinfo").splitlines():
        if line.startswith("model name"):
            cpu = line.split(":", 1)[1].strip()
            break
    du = shutil.disk_usage("/var" if os.path.exists("/var") else "/")
    st["hardware"] = {"host": socket.gethostname(), "kernel": platform.release(), "cpu": cpu,
                      "mem": mem, "disk_total": du.total, "disk_free": du.free, "arch": platform.machine()}
    st["wallpapers"] = {"list": wallpapers(), "current": current_wallpaper()}
    st["gamer"] = {
        "on": os.path.exists(GAMER_FLAG),
        "profile": sh("powerprofilesctl", "get"),
        "gamemode": shutil.which("gamemoded") is not None,
        "mangohud": shutil.which("mangohud") is not None,
        "console_session": os.path.exists("/usr/share/wayland-sessions/capix-gamer.desktop"),
        "cloud": CLOUD_GAMES,
    }
    st["gpu"] = gpu_status()
    st["backup"] = backup_status()
    st["printers"] = printers_status()
    st["profiles"] = profiles_status()
    st["privacy"] = privacy_status()
    st["user"] = os.environ.get("USER", "")
    st["welcome_done"] = os.path.exists(WELCOME_FLAG)
    return st


def gpu_status():
    try:
        out = sh("/usr/libexec/capix/gpu-status", timeout=12)
        return json.loads(out) if out else {}
    except Exception:
        return {}


def printers_status():
    env = dict(os.environ, LC_ALL="C")
    def lp(*a):
        try:
            return subprocess.run(["lpstat", *a], capture_output=True, text=True, timeout=6, env=env).stdout
        except Exception:
            return ""
    lista = []
    for line in lp("-p").splitlines():
        if line.startswith("printer "):
            p = line.split()
            lista.append({"nome": p[1], "estado": "pronta" if "idle" in line else "imprimindo" if "printing" in line else "pausada" if "disabled" in line else "—"})
    d = lp("-d")
    return {"cups": sh("systemctl", "is-active", "cups.socket") == "active" or sh("systemctl", "is-active", "cups.service") == "active",
            "lista": lista, "padrao": d.split(":", 1)[1].strip() if ":" in d else "",
            "scan_app": shutil.which("skanpage") is not None}


def profiles_status():
    try:
        c = json.load(open(PROFILES_CFG))
    except Exception:
        c = {}
    return {"ativo": "investigacao" if os.path.exists(PROFILE_FLAG) else "pessoal",
            "vpn": str(c.get("vpn", "")), "abrir": [x for x in c.get("abrir", ["faro", "descartavel"]) if x in PROFILE_TOOLS]}


def backup_status():
    try:
        out = sh("/usr/libexec/capix/capix-backup", "status", timeout=10)
        return json.loads(out) if out else {}
    except Exception:
        return {}


def privacy_status():
    vpns = []
    out = sh("nmcli", "-t", "-f", "NAME,TYPE,STATE", "connection", "show", timeout=6)
    for line in out.splitlines():
        parts = line.split(":")
        if len(parts) >= 3 and parts[1] == "wireguard":
            vpns.append({"nome": parts[0], "ativa": parts[2] == "activated"})
    installed = set(sh("flatpak", "list", "--app", "--columns=application", timeout=15).split())
    return {"vpns": vpns,
            "usbguard": {"disponivel": shutil.which("usbguard") is not None,
                         "ativo": sh("systemctl", "is-active", "usbguard.service") == "active"},
            "firewall": sh("systemctl", "is-active", "firewalld") == "active",
            "cofre_instalado": "org.keepassxc.KeePassXC" in installed or "com.bitwarden.desktop" in installed,
            "tor_instalado": "org.torproject.torbrowser-launcher" in installed}


def mock_status():
    return {
        "os": {"name": "Capix Linux OS 44", "version": "44"},
        "updates": {"booted": {"version": "44.20261110.0", "image": "ghcr.io/capix/capix:44", "date": 1762790000},
                    "staged": None, "rollback": {"version": "44.20261103.0", "image": "ghcr.io/capix/capix:44", "date": 1762180000},
                    "auto": True, "last_check": "qui 2026-11-12 21:40:03 -03"},
        "android": {"installed": True, "initialized": False, "running": False},
        "apps": [dict(a, installed=a["default"]) for a in apps_catalog()],
        "antivirus": {"last": "2026-11-09 03:12", "scanned": 18432, "infected": 0, "running": False, "auto": True},
        "firewall": True,
        "kiosk": {"enabled": False, "url": ""},
        "appearance": {"dark": True},
        "hardware": {"host": "capivara", "kernel": "6.17.7-200.fc44.x86_64", "cpu": "Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz",
                     "mem": 8 * 1024**3, "disk_total": 256 * 1000**3, "disk_free": 171 * 1000**3, "arch": "x86_64"},
        "wallpapers": {"list": wallpapers(), "current": "capix"},
        "gamer": {"on": os.path.exists(GAMER_FLAG), "profile": "balanced", "gamemode": True, "mangohud": True,
                  "console_session": True, "cloud": CLOUD_GAMES},
        "gpu": {"variante": "open",
                "gpus": [{"vendor": "AMD", "name": "AMD Radeon Graphics (Ryzen 5 5600U)", "driver": "amdgpu", "slot": "0000:06:00.0", "render": "renderD128"},
                         {"vendor": "NVIDIA", "name": "NVIDIA GeForce RTX 3050 Laptop GPU", "driver": "nouveau", "slot": "0000:01:00.0", "render": "renderD129"}],
                "vulkan": ["AMD Radeon Graphics (RADV REMBRANDT)"], "vaapi": "Mesa Gallium 24.2",
                "nvidia": {"driver_carregado": False, "nouveau": True},
                "recomendacao": {"nivel": "trocar-imagem",
                                 "texto": "Esta máquina tem uma placa NVIDIA, mas o sistema está na imagem aberta (sem o driver proprietário). Para melhor desempenho em jogos e aplicativos 3D, troque para a imagem com driver NVIDIA.",
                                 "comando": "sudo bootc switch ghcr.io/SEU_USUARIO/capix-nvidia:44"}},
        "backup": {"configurado": True, "dest": "/run/media/capix/HD-Backup/CapixBackup", "disponivel": True,
                   "auto": True, "keep": 10, "ultimo": "2026-11-13 02:00", "ok": True, "rodando": False,
                   "disco": {"total": 1000 * 1000**3, "livre": 612 * 1000**3},
                   "snapshots": [{"nome": "snap-2026-11-13_02-00-11", "quando": "2026-11-13 02:00", "data": 1},
                                 {"nome": "snap-2026-11-12_02-00-09", "quando": "2026-11-12 02:00", "data": 1},
                                 {"nome": "snap-2026-11-11_02-00-07", "quando": "2026-11-11 02:00", "data": 1}]},
        "printers": {"cups": True, "padrao": "HP_LaserJet_M110w", "scan_app": True,
                     "lista": [{"nome": "HP_LaserJet_M110w", "estado": "pronta"}, {"nome": "EPSON_L3250_Series", "estado": "pronta"}]},
        "profiles": {"ativo": "pessoal", "vpn": "Trabalho (WireGuard)", "abrir": ["faro", "keepass", "descartavel"]},
        "privacy": {"vpns": [{"nome": "Trabalho (WireGuard)", "ativa": False}, {"nome": "Casa", "ativa": True}],
                    "usbguard": {"disponivel": True, "ativo": False}, "firewall": True,
                    "cofre_instalado": False, "tor_instalado": False},
        "user": os.environ.get("USER", "capix"),
        "welcome_done": os.path.exists(WELCOME_FLAG),
    }

# ---------------------------------------------------------------- ações

ADMIN_VERBS = {
    "update-now": 0, "rollback": 0, "auto-updates": 1, "android-init": 1, "android-remove": 0,
    "flatpak-install": 1, "flatpak-remove": 1, "av-scan": 0, "av-update": 0,
    "kiosk-enable": 1, "kiosk-disable": 0,
    "vpn-up": 1, "vpn-down": 1, "usbguard": 1,
}
OPENERS = {
    "android": ["capix-android"],
    "settings": ["systemsettings"],
    "wifi": ["systemsettings", "kcm_networkmanagement"],
    "display": ["systemsettings", "kcm_kscreen"],
    "users": ["systemsettings", "kcm_users"],
    "store": ["plasma-discover"],
    "files": ["dolphin"],
    "browser": ["chromium-browser"],
    "assistant": ["flatpak", "run", "com.jeffser.Alpaca"],
    "faro": ["capix-faro"],
    "keepass": ["flatpak", "run", "org.keepassxc.KeePassXC"],
    "tor": ["flatpak", "run", "org.torproject.torbrowser-launcher"],
    "printers": ["systemsettings", "kcm_printer_manager"],
    "scan": ["skanpage"],
    "descartavel": ["capix-navegador-descartavel"],
}
PROFILES_CFG = os.path.join(HOME, ".config/capix/profiles.json")
PROFILE_FLAG = os.path.join(HOME, ".config/capix/profile-active")
PROFILE_TOOLS = ("faro", "keepass", "descartavel", "tor")


def user_action(name, args):
    """Ações do próprio usuário (sem root). Devolve lista de comandos."""
    if name == "open":
        if len(args) != 1 or args[0] not in OPENERS:
            raise ValueError("app desconhecido")
        return [OPENERS[args[0]]], True          # True = desacoplado (não espera)
    if name == "theme":
        if args not in (["dark"], ["light"]):
            raise ValueError("tema inválido")
        scheme = "BreezeDark" if args[0] == "dark" else "BreezeLight"
        return [["plasma-apply-colorscheme", scheme],
                ["kwriteconfig6", "--file", "kdeglobals", "--group", "General", "--key", "AccentColor", "246,139,44"]], False
    if name == "gamer":
        if args not in (["on"], ["off"]):
            raise ValueError("use on|off")
        on = args[0] == "on"
        if not DRY:
            os.makedirs(os.path.dirname(GAMER_FLAG), exist_ok=True)
            if on:
                open(GAMER_FLAG, "w").close()
            elif os.path.exists(GAMER_FLAG):
                os.remove(GAMER_FLAG)
        cmds = [["powerprofilesctl", "set", "performance" if on else "balanced"]]
        cmds.append(["/usr/libexec/capix/gamer-dnd", "on" if on else "off"])   # "Não perturbe"
        return cmds, False
    if name == "open-app":
        if len(args) != 1 or args[0] not in {a["id"] for a in apps_catalog()}:
            raise ValueError("app desconhecido")
        return [["flatpak", "run", args[0]]], True
    if name == "open-cloud":
        g = next((g for g in CLOUD_GAMES if [g["id"]] == args), None)
        if not g:
            raise ValueError("serviço desconhecido")
        return [[OPENERS["browser"][0], f"--app={g['url']}", "--start-maximized"]], True
    if name == "wallpaper":
        w = next((w for w in wallpapers() if [w["id"]] == args), None)
        if not w:
            raise ValueError("papel de parede desconhecido")
        return [["plasma-apply-wallpaperimage", w["dir"]]], False
    if name == "wallpaper-get":
        return [["knewstuff-dialog6", "wallpaper.knsrc"]], True
    if name == "wallpaper-own":
        return [["/usr/libexec/capix/pick-wallpaper"]], False
    if name == "welcome-done":
        if not DRY:
            os.makedirs(os.path.dirname(WELCOME_FLAG), exist_ok=True)
            open(WELCOME_FLAG, "w").close()
        return [], False
    # --- Backup (tudo nível de usuário) ---
    if name == "backup-run":
        return [["/usr/libexec/capix/capix-backup", "run"]], False
    if name == "backup-pick-dest":
        return [["/usr/libexec/capix/backup-pick-dest"]], False
    if name == "backup-auto":
        if args not in (["on"], ["off"]):
            raise ValueError("use on|off")
        return [["systemctl", "--user", "enable" if args[0] == "on" else "disable", "--now", "capix-backup.timer"]], False
    # --- Privacidade (nível de usuário) ---
    if name == "vpn-import":
        return [["/usr/libexec/capix/vpn-import"]], False
    if name == "profile":
        if args not in (["investigacao"], ["pessoal"]):
            raise ValueError("perfil inválido")
        return [["/usr/libexec/capix/profile-switch", args[0]]], False
    if name == "profile-config":
        # args: [nome da VPN ou "", itens separados por vírgula]
        if len(args) != 2:
            raise ValueError("argumentos inválidos")
        vpn, itens = args[0], [x for x in args[1].split(",") if x]
        known = {v["nome"] for v in privacy_status()["vpns"]} if not DRY else None
        if vpn and known is not None and vpn not in known:
            raise ValueError("VPN desconhecida")
        if len(vpn) > 100 or any(i not in PROFILE_TOOLS for i in itens):
            raise ValueError("configuração inválida")
        if not DRY:
            os.makedirs(os.path.dirname(PROFILES_CFG), exist_ok=True)
            json.dump({"vpn": vpn, "abrir": itens}, open(PROFILES_CFG, "w"))
        return [], False
    if name == "shred-file":
        return [["/usr/libexec/capix/shred-file"]], False
    raise ValueError("ação desconhecida")


def start_job(cmds, detach=False):
    jid = secrets.token_hex(6)
    job = {"done": False, "code": None, "log": []}
    with JOBS_LOCK:
        JOBS[jid] = job

    def worker():
        code = 0
        for cmd in cmds:
            job["log"].append("$ " + " ".join(cmd))
            if DRY and cmd[0] != ADMIN:          # o capix-admin tem seu próprio modo simulação
                time.sleep(0.6)
                job["log"].append("(simulação) ok")
                continue
            try:
                if detach:
                    subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
                    continue
                p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
                for line in p.stdout:
                    job["log"].append(line.rstrip())
                    del job["log"][:-400]
                code = p.wait()
                if code != 0:
                    break
            except FileNotFoundError:
                job["log"].append(f"não encontrado: {cmd[0]}")
                code = 127
                break
        job["code"], job["done"] = code, True

    threading.Thread(target=worker, daemon=True).start()
    return jid


def handle_action(body):
    name = body.get("action")
    args = body.get("args") or []
    if not isinstance(name, str) or not isinstance(args, list) or not all(isinstance(a, str) for a in args):
        raise ValueError("pedido inválido")
    if name in ADMIN_VERBS:
        if len(args) != ADMIN_VERBS[name]:
            raise ValueError("argumentos inválidos")
        cmd = [ADMIN, name, *args] if DRY else ["pkexec", ADMIN, name, *args]
        return start_job([cmd])
    cmds, detach = user_action(name, args)
    return start_job(cmds, detach)

# ---------------------------------------------------------------- HTTP

class Handler(http.server.BaseHTTPRequestHandler):
    server_version = "CapixCentral/1.0"

    def log_message(self, *a):
        pass

    def _ok_host(self):
        host = self.headers.get("Host", "")
        return host in (f"127.0.0.1:{self.server.server_port}", f"localhost:{self.server.server_port}")

    def _send(self, code, body, ctype="application/json; charset=utf-8"):
        data = body if isinstance(body, bytes) else json.dumps(body, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'")
        self.end_headers()
        self.wfile.write(data)

    def _route(self):
        if not self._ok_host():
            return None
        parts = urllib.parse.urlsplit(self.path).path.split("/", 2)
        if len(parts) < 2 or not secrets.compare_digest(parts[1], TOKEN):
            return None
        return "/" + (parts[2] if len(parts) > 2 else "")

    def do_GET(self):
        route = self._route()
        if route is None:
            return self._send(403, {"error": "proibido"})
        if route in ("/", "/index.html"):
            html = read(os.path.join(WEB, "index.html")).replace("__CAPIX_DRY__", "true" if DRY else "false")
            return self._send(200, html.encode(), "text/html; charset=utf-8")
        if route.startswith("/assets/"):
            name = os.path.basename(route)
            path = os.path.join(WEB, "assets", name)
            if os.path.isfile(path):
                ctype = {"png": "image/png", "svg": "image/svg+xml", "webp": "image/webp"}.get(name.rsplit(".", 1)[-1], "application/octet-stream")
                with open(path, "rb") as f:
                    return self._send(200, f.read(), ctype)
            return self._send(404, {"error": "não encontrado"})
        if route == "/api/status":
            return self._send(200, status())
        if route.startswith("/api/job/"):
            job = JOBS.get(route.rsplit("/", 1)[-1])
            return self._send(200, job) if job else self._send(404, {"error": "job não encontrado"})
        return self._send(404, {"error": "não encontrado"})

    def do_POST(self):
        route = self._route()
        if route is None:
            return self._send(403, {"error": "proibido"})
        if route != "/api/run" or not self.headers.get("Content-Type", "").startswith("application/json"):
            return self._send(400, {"error": "pedido inválido"})
        try:
            n = int(self.headers.get("Content-Length", "0"))
            if n > 8192:
                raise ValueError("pedido grande demais")
            body = json.loads(self.rfile.read(n) or b"{}")
            return self._send(200, {"job": handle_action(body)})
        except (ValueError, json.JSONDecodeError) as e:
            return self._send(400, {"error": str(e)})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--welcome", action="store_true")
    ap.add_argument("--page", default="")
    ap.add_argument("--port", type=int, default=0)
    ap.add_argument("--no-browser", action="store_true")
    ap.add_argument("--idle-exit", type=int, default=0, help="encerra após N s sem acessos (0 = nunca)")
    a = ap.parse_args()
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", a.port), Handler)
    frag = "#welcome" if a.welcome else (f"#{a.page}" if a.page else "")
    url = f"http://127.0.0.1:{srv.server_port}/{TOKEN}/{frag}"
    print(url, flush=True)
    if not a.no_browser:
        browser = shutil.which("chromium-browser") or shutil.which("chromium")
        if browser:
            prof = os.path.join(HOME, ".cache/capix-central")
            proc = subprocess.Popen([browser, f"--app={url}", f"--user-data-dir={prof}", "--no-first-run",
                                     "--window-size=1100,720", "--class=CapixCentral"])
            threading.Thread(target=lambda: (proc.wait(), srv.shutdown()), daemon=True).start()
    srv.serve_forever()


if __name__ == "__main__":
    main()
