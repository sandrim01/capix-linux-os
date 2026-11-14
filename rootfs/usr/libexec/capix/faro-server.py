#!/usr/bin/env python3
"""
Capix Faro — ferramenta de OSINT de infraestrutura e ameaças (só stdlib).

Módulos: domínio, IP, link, arquivo, hash, cabeçalho de e-mail, extrator de IOCs, casos.
Fontes públicas e passivas: DNS, RDAP (rdap.org), Certificate Transparency (crt.sh),
Shodan InternetDB (sem chave). Opcionais com chave: VirusTotal, abuse.ch (MalwareBazaar/URLhaus).
Não faz varredura ativa de portas nem busca de pessoas.

Segurança: escuta só em 127.0.0.1, token aleatório no caminho, confere o Host.
Uso: faro-server.py [--no-browser] [--port N]      CAPIX_DRYRUN=1 = respostas de demonstração
"""
import argparse, base64, datetime as dt, email, email.policy, email.utils, hashlib, http.server, ipaddress, json, os, re
import secrets, shutil, socket, ssl, subprocess, sys, threading, time, urllib.error, urllib.parse, urllib.request

DRY = os.environ.get("CAPIX_DRYRUN") == "1"
WEB = os.environ.get("FARO_WEB", "/usr/share/capix/faro")
HOME = os.path.expanduser("~")
CFG = os.path.join(HOME, ".config/capix/faro.json")
CASES = os.path.join(HOME, ".local/share/capix/faro/cases")
TOKEN = secrets.token_urlsafe(24)
UA = "CapixFaro/1.0 (+OSINT; Capix Linux OS by UnbugSTI)"
MAX_FILE = 50 * 1024 * 1024

# ---------------------------------------------------------------- utilidades

def now():
    return dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def load_cfg():
    try:
        with open(CFG) as f:
            return json.load(f)
    except Exception:
        return {}


def save_cfg(c):
    os.makedirs(os.path.dirname(CFG), exist_ok=True)
    fd = os.open(CFG, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as f:
        json.dump(c, f)


def fetch(url, method="GET", headers=None, data=None, timeout=10, maxbytes=2_000_000, follow=True):
    req = urllib.request.Request(url, method=method, data=data, headers={"User-Agent": UA, **(headers or {})})
    opener = urllib.request.build_opener() if follow else urllib.request.build_opener(NoRedirect)
    with opener.open(req, timeout=timeout) as r:
        return r.status, dict(r.headers), r.read(maxbytes), r.geturl()


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


def get_json(url, **kw):
    try:
        st, h, body, _ = fetch(url, **kw)
        return json.loads(body)
    except Exception as e:
        return {"_erro": str(e)}


def run(cmd, timeout=8):
    try:
        return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout).stdout
    except Exception:
        return ""


DOMAIN_RE = re.compile(r"^(?=.{1,253}$)(?!-)([a-z0-9-]{1,63}(?<!-)\.)+[a-z]{2,63}$", re.I)


def norm_domain(q):
    q = q.strip().lower()
    if "://" in q:
        q = urllib.parse.urlsplit(q).hostname or ""
    q = q.strip(".").removeprefix("www.") if q.startswith("www.") else q.strip(".")
    try:
        q = q.encode("idna").decode()
    except Exception:
        pass
    if not DOMAIN_RE.match(q):
        raise ValueError("domínio inválido")
    return q


def norm_ip(q):
    ip = ipaddress.ip_address(q.strip())
    return ip

# ---------------------------------------------------------------- IOCs

IOC = {
    "url": re.compile(r"\bh[tx]{2}ps?\[?:\]?//[^\s\"'<>]+", re.I),
    "ipv4": re.compile(r"\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\[?\.\]?){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b"),
    "email": re.compile(r"\b[a-z0-9._%+-]+(?:@|\[at\])[a-z0-9.-]+\[?\.\]?[a-z]{2,}\b", re.I),
    "domain": re.compile(r"\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.|\[\.\]))+(?:com|net|org|br|io|ru|cn|info|xyz|top|online|site|app|dev|gov|edu|co|me|tk|ml|ga|cf|gq|biz|us|uk|de|fr|es|it|pt|ar|mx|cl|in|jp|kr|tv|cc|ly|link|click|shop|store|live|cloud)\b", re.I),
    "sha256": re.compile(r"\b[a-f0-9]{64}\b", re.I),
    "sha1": re.compile(r"\b[a-f0-9]{40}\b", re.I),
    "md5": re.compile(r"\b[a-f0-9]{32}\b", re.I),
    "cve": re.compile(r"\bCVE-\d{4}-\d{4,7}\b", re.I),
}


def refang(s):
    return s.replace("[.]", ".").replace("[:]", ":").replace("hxxp", "http").replace("[at]", "@")


def defang(s):
    return s.replace("http", "hxxp").replace(".", "[.]")


def extract_iocs(text, limit=300):
    out = {}
    taken = set()
    for kind in ("url", "email", "sha256", "sha1", "md5", "cve", "ipv4", "domain"):
        vals = []
        for m in IOC[kind].finditer(text):
            v = refang(m.group(0)).rstrip(").,;]")
            if kind == "md5" and any(v in t for t in taken):
                continue
            if kind == "sha1" and any(v in t for t in taken):
                continue
            if kind == "domain" and any(v in t for t in taken):
                continue
            if kind == "ipv4":
                try:
                    ip = ipaddress.ip_address(v)
                    if ip.is_private or ip.is_loopback or ip.is_reserved:
                        continue
                except ValueError:
                    continue
            if v not in vals:
                vals.append(v)
        if vals:
            out[kind] = vals[:limit]
            taken.update(vals)
    return out

# ---------------------------------------------------------------- módulos

def dns_records(name):
    rec = {}
    if shutil.which("dig"):
        for t in ("A", "AAAA", "MX", "NS", "TXT", "CNAME", "SOA", "CAA"):
            out = [l.strip() for l in run(["dig", "+short", "+time=3", "+tries=1", t, name]).splitlines() if l.strip()]
            if out:
                rec[t] = out
    else:
        try:
            infos = socket.getaddrinfo(name, None)
            rec["A"] = sorted({i[4][0] for i in infos if i[0] == socket.AF_INET})
            rec["AAAA"] = sorted({i[4][0] for i in infos if i[0] == socket.AF_INET6})
        except Exception:
            pass
    return rec


def rdap_domain(d):
    j = get_json(f"https://rdap.org/domain/{d}")
    if "_erro" in j:
        return j
    ev = {e.get("eventAction"): e.get("eventDate", "")[:10] for e in j.get("events", [])}
    registrar = ""
    for ent in j.get("entities", []):
        if "registrar" in ent.get("roles", []):
            for item in (ent.get("vcardArray") or [None, []])[1]:
                if item[0] == "fn":
                    registrar = item[3]
    created = ev.get("registration", "")
    age = None
    if created:
        try:
            age = (dt.date.today() - dt.date.fromisoformat(created)).days
        except ValueError:
            pass
    return {"registrar": registrar, "criado": created, "expira": ev.get("expiration", ""), "atualizado": ev.get("last changed", ""),
            "idade_dias": age, "status": j.get("status", []), "nameservers": [n.get("ldhName", "").lower() for n in j.get("nameservers", [])]}


def crtsh(d, limit=400):
    try:
        st, h, body, _ = fetch(f"https://crt.sh/?q=%25.{d}&output=json", timeout=25, maxbytes=20_000_000)
        names = set()
        for row in json.loads(body):
            for n in row.get("name_value", "").split("\n"):
                n = n.strip().lower().lstrip("*.")
                if n.endswith(d):
                    names.add(n)
        return sorted(names)[:limit]
    except Exception as e:
        return {"_erro": str(e)}


def tls_info(host, port=443):
    try:
        ctx = ssl.create_default_context()
        with socket.create_connection((host, port), timeout=8) as s, ctx.wrap_socket(s, server_hostname=host) as t:
            c = t.getpeercert()
            exp = dt.datetime.strptime(c["notAfter"], "%b %d %H:%M:%S %Y %Z")
            flat = lambda x: ", ".join("=".join(p) for r in x for p in r)
            return {"valido": True, "versao": t.version(), "emissor": flat(c.get("issuer", [])), "assunto": flat(c.get("subject", [])),
                    "de": c["notBefore"], "ate": c["notAfter"], "dias_restantes": (exp - dt.datetime.utcnow()).days,
                    "sans": [v for k, v in c.get("subjectAltName", []) if k == "DNS"][:50]}
    except ssl.SSLCertVerificationError as e:
        return {"valido": False, "erro": e.verify_message}
    except Exception as e:
        return {"_erro": str(e)}


SEC_HEADERS = ["strict-transport-security", "content-security-policy", "x-frame-options", "x-content-type-options",
               "referrer-policy", "permissions-policy"]


def http_info(url):
    chain = []
    cur = url
    try:
        for _ in range(10):
            try:
                st, h, body, final = fetch(cur, follow=False, maxbytes=400_000)
            except urllib.error.HTTPError as e:
                st, h, body = e.code, dict(e.headers), e.read(400_000) if e.fp else b""
            chain.append({"url": cur, "status": st})
            loc = {k.lower(): v for k, v in h.items()}.get("location")
            if st in (301, 302, 303, 307, 308) and loc:
                cur = urllib.parse.urljoin(cur, loc)
                continue
            break
        hl = {k.lower(): v for k, v in h.items()}
        text = body.decode("utf-8", "replace")
        title = re.search(r"<title[^>]*>(.*?)</title>", text, re.I | re.S)
        gen = re.search(r'<meta[^>]+name=["\']generator["\'][^>]+content=["\']([^"\']+)', text, re.I)
        return {"cadeia": chain, "final": cur, "status": st, "titulo": (title.group(1).strip()[:200] if title else ""),
                "servidor": hl.get("server", ""), "tecnologia": ", ".join(x for x in [hl.get("x-powered-by", ""), gen.group(1) if gen else ""] if x),
                "cabecalhos_seguranca": {k: (k in hl) for k in SEC_HEADERS},
                "formularios_senha": len(re.findall(r'type=["\']password', text, re.I))}
    except Exception as e:
        return {"cadeia": chain, "_erro": str(e)}


def email_auth(d):
    txt = dns_records(d).get("TXT", [])
    spf = next((t.strip('"') for t in txt if "v=spf1" in t.lower()), "")
    dmarc = next((t.strip('"') for t in dns_records("_dmarc." + d).get("TXT", []) if "v=dmarc1" in t.lower()), "")
    pol = re.search(r"p=(\w+)", dmarc or "")
    return {"spf": spf, "dmarc": dmarc, "dmarc_politica": pol.group(1) if pol else ""}


def mod_domain(q):
    d = norm_domain(q)
    if DRY:
        return demo("domain", d)
    res = {"alvo": d, "quando": now()}
    th = {}
    jobs = {"dns": lambda: dns_records(d), "registro": lambda: rdap_domain(d), "subdominios": lambda: crtsh(d),
            "tls": lambda: tls_info(d), "web": lambda: http_info(f"https://{d}/"), "email": lambda: email_auth(d)}
    for k, fn in jobs.items():
        th[k] = threading.Thread(target=lambda k=k, fn=fn: res.__setitem__(k, fn()))
        th[k].start()
    for t in th.values():
        t.join(30)
    res["alertas"] = domain_alerts(res)
    return res


def domain_alerts(r):
    a = []
    reg = r.get("registro") or {}
    if isinstance(reg.get("idade_dias"), int) and reg["idade_dias"] < 60:
        a.append(["alto", f"Domínio registrado há só {reg['idade_dias']} dias — comum em golpes e phishing."])
    tls = r.get("tls") or {}
    if tls.get("valido") is False:
        a.append(["alto", f"Certificado TLS inválido: {tls.get('erro')}"])
    elif isinstance(tls.get("dias_restantes"), int) and tls["dias_restantes"] < 15:
        a.append(["medio", f"Certificado expira em {tls['dias_restantes']} dias."])
    em = r.get("email") or {}
    if not em.get("spf"):
        a.append(["medio", "Sem registro SPF: qualquer um pode enviar e-mails fingindo ser este domínio."])
    if not em.get("dmarc"):
        a.append(["medio", "Sem DMARC: e-mails falsos com este domínio não são bloqueados."])
    elif em.get("dmarc_politica") == "none":
        a.append(["baixo", "DMARC só em monitoramento (p=none)."])
    web = r.get("web") or {}
    miss = [k for k, v in (web.get("cabecalhos_seguranca") or {}).items() if not v]
    if miss:
        a.append(["baixo", "Cabeçalhos de segurança ausentes: " + ", ".join(miss)])
    return a


def mod_ip(q):
    ip = norm_ip(q)
    if ip.is_private or ip.is_loopback:
        raise ValueError("IP privado/local: não há dados públicos")
    if DRY:
        return demo("ip", str(ip))
    res = {"alvo": str(ip), "quando": now()}
    try:
        res["dns_reverso"] = socket.gethostbyaddr(str(ip))[0]
    except Exception:
        res["dns_reverso"] = ""
    j = get_json(f"https://rdap.org/ip/{ip}")
    if "_erro" not in j:
        org = ""
        for ent in j.get("entities", []):
            for item in (ent.get("vcardArray") or [None, []])[1]:
                if item[0] == "fn" and not org:
                    org = item[3]
        res["rede"] = {"nome": j.get("name", ""), "faixa": f"{j.get('startAddress', '')} – {j.get('endAddress', '')}",
                       "pais": j.get("country", ""), "organizacao": org, "tipo": j.get("type", "")}
    else:
        res["rede"] = j
    idb = get_json(f"https://internetdb.shodan.io/{ip}")
    res["exposicao"] = {"portas": idb.get("ports", []), "vulns": idb.get("vulns", [])[:50], "tags": idb.get("tags", []),
                        "hostnames": idb.get("hostnames", []), "cpes": idb.get("cpes", [])[:20]} if "_erro" not in idb and "detail" not in idb else {"portas": [], "vulns": [], "tags": [], "hostnames": [], "cpes": [], "obs": "sem dados no InternetDB"}
    res["reputacao"] = vt_lookup("ip_addresses", str(ip))
    a = []
    if res["exposicao"]["vulns"]:
        a.append(["alto", f"{len(res['exposicao']['vulns'])} vulnerabilidade(s) conhecida(s) associadas aos serviços expostos."])
    risky = {21: "FTP", 23: "Telnet", 445: "SMB", 3389: "RDP", 5900: "VNC", 3306: "MySQL", 5432: "PostgreSQL", 6379: "Redis", 9200: "Elasticsearch", 27017: "MongoDB"}
    exp = [f"{p} ({risky[p]})" for p in res["exposicao"]["portas"] if p in risky]
    if exp:
        a.append(["medio", "Serviços sensíveis expostos na internet: " + ", ".join(exp)])
    if "tor" in res["exposicao"]["tags"]:
        a.append(["medio", "IP de saída da rede Tor."])
    res["alertas"] = a + vt_alerts(res["reputacao"])
    return res


SUSP_WORDS = ["login", "signin", "verify", "verificar", "atualizar", "conta", "account", "secure", "banco", "bank", "senha", "password",
              "pix", "boleto", "premio", "prêmio", "gratis", "grátis", "suporte", "wallet", "confirm"]
SHORTENERS = {"bit.ly", "tinyurl.com", "t.co", "goo.gl", "is.gd", "cutt.ly", "ow.ly", "rebrand.ly", "shorturl.at", "encurtador.com.br", "t.ly"}


def mod_url(q):
    u = refang(q.strip())
    if not re.match(r"^https?://", u, re.I):
        u = "http://" + u
    parts = urllib.parse.urlsplit(u)
    if not parts.hostname:
        raise ValueError("link inválido")
    if DRY:
        return demo("url", u)
    res = {"alvo": u, "quando": now(), "web": http_info(u)}
    final_host = urllib.parse.urlsplit(res["web"].get("final", u)).hostname or parts.hostname
    a = []
    hosts = {parts.hostname, final_host}
    for h in hosts:
        try:
            ipaddress.ip_address(h)
            a.append(["alto", f"O link usa um IP direto ({h}) em vez de um nome de site."])
        except ValueError:
            pass
        if "xn--" in h:
            a.append(["alto", f"Domínio com caracteres internacionais (punycode: {h}) — pode imitar outro site."])
        if h.count(".") >= 4:
            a.append(["medio", f"Muitos subdomínios em {h} — truque comum para esconder o domínio real."])
    if parts.hostname in SHORTENERS:
        a.append(["baixo", "Link encurtado: o destino real só aparece depois dos redirecionamentos."])
    if "@" in parts.netloc:
        a.append(["alto", "O link tem '@' antes do domínio — o navegador ignora o que vem antes e vai para outro site."])
    words = [w for w in SUSP_WORDS if w in u.lower()]
    if words:
        a.append(["medio", "Palavras típicas de phishing no endereço: " + ", ".join(words)])
    if len(res["web"].get("cadeia", [])) > 3:
        a.append(["medio", f"{len(res['web']['cadeia']) - 1} redirecionamentos até o destino."])
    if res["web"].get("formularios_senha"):
        a.append(["medio", "A página final pede senha."])
    try:
        reg = rdap_domain(".".join(final_host.split(".")[-2:])) if final_host and not final_host.replace(".", "").isdigit() else {}
        res["registro"] = reg
        if isinstance(reg.get("idade_dias"), int) and reg["idade_dias"] < 60:
            a.append(["alto", f"O domínio de destino foi registrado há {reg['idade_dias']} dias."])
    except Exception:
        pass
    res["reputacao"] = vt_lookup("urls", base64.urlsafe_b64encode(u.encode()).decode().strip("="))
    res["alertas"] = a + vt_alerts(res["reputacao"])
    res["risco"] = risk(res["alertas"])
    return res


def risk(alerts):
    score = sum({"alto": 40, "medio": 15, "baixo": 5}[a[0]] for a in alerts)
    return {"pontos": min(100, score), "nivel": "alto" if score >= 40 else "medio" if score >= 15 else "baixo"}


def vt_lookup(kind, ident):
    key = load_cfg().get("virustotal")
    if not key:
        return {"fonte": "VirusTotal", "obs": "adicione a chave da API em Configurações para consultar a reputação"}
    j = get_json(f"https://www.virustotal.com/api/v3/{kind}/{ident}", headers={"x-apikey": key})
    if "_erro" in j:
        return {"fonte": "VirusTotal", "obs": "não encontrado ou erro: " + j["_erro"][:120]}
    st = j.get("data", {}).get("attributes", {}).get("last_analysis_stats", {})
    return {"fonte": "VirusTotal", "malicioso": st.get("malicious", 0), "suspeito": st.get("suspicious", 0),
            "inofensivo": st.get("harmless", 0), "nao_detectado": st.get("undetected", 0)}


def vt_alerts(rep):
    if rep.get("malicioso"):
        return [["alto", f"VirusTotal: {rep['malicioso']} antivírus marcaram como malicioso."]]
    if rep.get("suspeito"):
        return [["medio", f"VirusTotal: {rep['suspeito']} antivírus marcaram como suspeito."]]
    return []


def bazaar(h):
    key = load_cfg().get("abusech")
    if not key:
        return {"fonte": "MalwareBazaar", "obs": "adicione a chave abuse.ch em Configurações"}
    try:
        st, hd, body, _ = fetch("https://mb-api.abuse.ch/api/v1/", method="POST", headers={"Auth-Key": key},
                               data=urllib.parse.urlencode({"query": "get_info", "hash": h}).encode())
        j = json.loads(body)
        if j.get("query_status") != "ok":
            return {"fonte": "MalwareBazaar", "obs": "hash não encontrado (bom sinal)"}
        d = j["data"][0]
        return {"fonte": "MalwareBazaar", "malware": d.get("signature") or "desconhecido", "tipo": d.get("file_type"),
                "visto_em": d.get("first_seen"), "tags": d.get("tags") or []}
    except Exception as e:
        return {"fonte": "MalwareBazaar", "obs": str(e)[:120]}


def mod_hash(q):
    h = q.strip().lower()
    kind = {32: "MD5", 40: "SHA-1", 64: "SHA-256"}.get(len(h))
    if not kind or not re.fullmatch(r"[a-f0-9]+", h):
        raise ValueError("hash inválido (use MD5, SHA-1 ou SHA-256)")
    if DRY:
        return demo("hash", h)
    res = {"alvo": h, "tipo": kind, "quando": now(), "reputacao": vt_lookup("files", h), "malwarebazaar": bazaar(h)}
    a = vt_alerts(res["reputacao"])
    if res["malwarebazaar"].get("malware"):
        a.append(["alto", f"MalwareBazaar: amostra conhecida de {res['malwarebazaar']['malware']}."])
    res["alertas"] = a
    return res


MAGIC = [(b"MZ", "Executável do Windows (PE)"), (b"\x7fELF", "Executável Linux (ELF)"), (b"%PDF", "Documento PDF"),
         (b"PK\x03\x04", "Arquivo ZIP / Office (docx, xlsx) / APK / JAR"), (b"\xd0\xcf\x11\xe0", "Documento Office antigo (doc/xls) — pode ter macros"),
         (b"\x89PNG", "Imagem PNG"), (b"\xff\xd8\xff", "Imagem JPEG"), (b"GIF8", "Imagem GIF"), (b"Rar!", "Arquivo RAR"),
         (b"7z\xbc\xaf", "Arquivo 7-Zip"), (b"#!", "Script"), (b"{\\rtf", "Documento RTF")]


def mod_file(name, data):
    if len(data) > MAX_FILE:
        raise ValueError("arquivo maior que 50 MB")
    res = {"alvo": name, "quando": now(), "tamanho": len(data),
           "hashes": {"md5": hashlib.md5(data).hexdigest(), "sha1": hashlib.sha1(data).hexdigest(), "sha256": hashlib.sha256(data).hexdigest()},
           "tipo": next((t for m, t in MAGIC if data.startswith(m)), "Desconhecido / texto")}
    meta = {}
    if shutil.which("exiftool") and not DRY:
        tmp = os.path.join(os.environ.get("XDG_RUNTIME_DIR", "/tmp"), "faro-" + secrets.token_hex(6))
        try:
            fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, "wb") as f:
                f.write(data)
            j = json.loads(run(["exiftool", "-json", "-n", tmp], timeout=20) or "[{}]")[0]
            skip = {"SourceFile", "Directory", "FileName", "FilePermissions", "FileAccessDate", "FileInodeChangeDate", "FileModifyDate", "ExifToolVersion"}
            meta = {k: v for k, v in j.items() if k not in skip}
        finally:
            try:
                os.remove(tmp)
            except OSError:
                pass
    res["metadados"] = meta
    text = data[:5_000_000].decode("latin-1")
    strings = re.findall(r"[\x20-\x7e]{6,}", text)
    res["iocs"] = extract_iocs("\n".join(strings))
    a = []
    if any(k.startswith("GPS") for k in meta):
        a.append(["medio", "O arquivo contém coordenadas de GPS (local onde a foto foi tirada). Remova antes de compartilhar."])
    for k in ("Author", "Creator", "LastModifiedBy", "Producer", "Software"):
        if meta.get(k):
            a.append(["baixo", f"Metadado revela {k}: {str(meta[k])[:80]}"])
    if res["tipo"].startswith("Executável") and not name.lower().endswith((".exe", ".dll", ".msi", ".elf", ".bin", ".so")):
        a.append(["alto", "Arquivo executável disfarçado com outra extensão."])
    if "macros" in res["tipo"] or re.search(r"vbaProject|AutoOpen|Document_Open", text):
        a.append(["alto", "Documento com macros: pode executar código ao abrir."])
    if re.search(r"/JavaScript|/OpenAction|/Launch", text) and res["tipo"] == "Documento PDF":
        a.append(["medio", "PDF com ações automáticas ou JavaScript."])
    if DRY:
        res["reputacao"] = {"fonte": "VirusTotal", "obs": "demonstração"}
    else:
        res["reputacao"] = vt_lookup("files", res["hashes"]["sha256"])
        a += vt_alerts(res["reputacao"])
    res["alertas"] = a
    return res


def mod_email(raw):
    if len(raw) > 2_000_000:
        raise ValueError("texto grande demais")
    msg = email.message_from_string(raw, policy=email.policy.default)
    hops = []
    for r in msg.get_all("Received", []) or []:
        r = " ".join(str(r).split())
        frm = re.search(r"from\s+(\S+)", r)
        by = re.search(r"by\s+(\S+)", r)
        ips = [i for i in re.findall(r"\[?((?:\d{1,3}\.){3}\d{1,3})\]?", r)]
        date = r.rsplit(";", 1)[-1].strip() if ";" in r else ""
        try:
            when = email.utils.parsedate_to_datetime(date)
        except Exception:
            when = None
        hops.append({"de": frm.group(1) if frm else "", "por": by.group(1) if by else "", "ips": ips,
                     "data": when.isoformat() if when else date})
    hops.reverse()   # do remetente até você
    prev = None
    for h in hops:
        try:
            t = dt.datetime.fromisoformat(h["data"])
            h["atraso_s"] = int((t - prev).total_seconds()) if prev else 0
            prev = t
        except Exception:
            h["atraso_s"] = None
    auth = " ".join(str(x) for x in (msg.get_all("Authentication-Results", []) or []))
    res_auth = {k: (re.search(rf"\b{k}=(\w+)", auth, re.I).group(1).lower() if re.search(rf"\b{k}=(\w+)", auth, re.I) else "") for k in ("spf", "dkim", "dmarc")}
    addr = lambda h: email.utils.parseaddr(str(msg.get(h, "")))[1].lower()
    dom = lambda a: a.split("@")[-1] if "@" in a else ""
    frm, rp, rt = addr("From"), addr("Return-Path"), addr("Reply-To")
    pub_ips = []
    for h in hops:
        for i in h["ips"]:
            try:
                ip = ipaddress.ip_address(i)
                if not (ip.is_private or ip.is_loopback or ip.is_reserved) and i not in pub_ips:
                    pub_ips.append(i)
            except ValueError:
                pass
    res = {"alvo": str(msg.get("Subject", "")) or "e-mail sem assunto", "assunto": str(msg.get("Subject", "")), "de": str(msg.get("From", "")), "para": str(msg.get("To", "")),
           "data": str(msg.get("Date", "")), "return_path": rp, "reply_to": rt, "message_id": str(msg.get("Message-ID", "")),
           "mailer": str(msg.get("X-Mailer", "") or msg.get("User-Agent", "")), "autenticacao": res_auth, "saltos": hops,
           "ip_origem": pub_ips[0] if pub_ips else "", "ips_publicos": pub_ips, "quando": now()}
    body = ""
    for part in msg.walk():
        if part.get_content_type() in ("text/plain", "text/html"):
            try:
                body += part.get_content()
            except Exception:
                pass
    res["iocs"] = extract_iocs(body) if body else {}
    a = []
    for k, v in res_auth.items():
        if v == "none":
            a.append(["medio" if k != "spf" else "baixo", f"{k.upper()} ausente: a mensagem não traz assinatura/validação de {k.upper()}."])
        elif v in ("fail", "softfail", "permerror"):
            a.append(["alto" if k != "spf" or v == "fail" else "medio", f"{k.upper()} = {v}: o servidor não confirma que o e-mail veio de quem diz."])
        elif not v:
            a.append(["baixo", f"Sem resultado de {k.upper()} nos cabeçalhos."])
    if rp and frm and dom(rp) != dom(frm):
        a.append(["medio", f"Return-Path ({dom(rp)}) diferente do remetente ({dom(frm)})."])
    if rt and frm and dom(rt) != dom(frm):
        a.append(["alto", f"Respostas vão para outro domínio ({dom(rt)}) — típico de golpe."])
    mid = re.search(r"@([^>]+)>", res["message_id"])
    if mid and frm and not mid.group(1).lower().endswith(dom(frm)):
        a.append(["baixo", f"Message-ID gerado por {mid.group(1)}, não pelo domínio do remetente."])
    res["alertas"] = a
    res["risco"] = risk(a)
    return res

# ---------------------------------------------------------------- casos

def cases_list():
    os.makedirs(CASES, exist_ok=True)
    out = []
    for f in sorted(os.listdir(CASES)):
        if f.endswith(".json"):
            try:
                c = json.load(open(os.path.join(CASES, f)))
                out.append({"id": c["id"], "nome": c["nome"], "criado": c["criado"], "itens": len(c["itens"])})
            except Exception:
                pass
    return out


def case_path(cid):
    if not re.fullmatch(r"[a-f0-9]{12}", cid or ""):
        raise ValueError("caso inválido")
    return os.path.join(CASES, cid + ".json")


def case_save(c):
    os.makedirs(CASES, exist_ok=True)
    fd = os.open(case_path(c["id"]), os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as f:
        json.dump(c, f, ensure_ascii=False)


def case_action(body):
    act = body.get("acao")
    if act == "criar":
        nome = str(body.get("nome", "")).strip()[:120] or "Caso sem nome"
        c = {"id": secrets.token_hex(6), "nome": nome, "criado": now(), "itens": [], "notas": ""}
        case_save(c)
        return c
    c = json.load(open(case_path(body.get("id"))))
    if act == "ver":
        return c
    if act == "adicionar":
        item = body.get("item") or {}
        c["itens"].append({"modulo": str(item.get("modulo", ""))[:20], "alvo": str(item.get("alvo", ""))[:500],
                           "resultado": item.get("resultado"), "nota": str(item.get("nota", ""))[:2000], "quando": now()})
    elif act == "notas":
        c["notas"] = str(body.get("notas", ""))[:20000]
    elif act == "remover-item":
        i = int(body.get("indice", -1))
        if 0 <= i < len(c["itens"]):
            c["itens"].pop(i)
    elif act == "apagar":
        os.remove(case_path(c["id"]))
        return {"ok": True}
    else:
        raise ValueError("ação inválida")
    case_save(c)
    return c

# ---------------------------------------------------------------- demonstração

def demo(kind, q):
    if kind == "domain":
        r = {"alvo": q, "quando": now(),
             "dns": {"A": ["93.184.215.14"], "AAAA": ["2606:2800:21f:cb07:6820:80da:af6b:8b2c"], "MX": ["10 mail." + q + "."],
                     "NS": ["a.iana-servers.net.", "b.iana-servers.net."], "TXT": ['"v=spf1 -all"'], "CAA": ['0 issue "digicert.com"']},
             "registro": {"registrar": "Exemplo Registrar Ltda.", "criado": "1995-08-14", "expira": "2027-08-13", "atualizado": "2026-08-14",
                          "idade_dias": 11414, "status": ["client delete prohibited", "client transfer prohibited"], "nameservers": ["a.iana-servers.net", "b.iana-servers.net"]},
             "subdominios": ["www." + q, "mail." + q, "api." + q, "dev." + q, "vpn." + q, "status." + q],
             "tls": {"valido": True, "versao": "TLSv1.3", "emissor": "C=US, O=DigiCert Inc, CN=DigiCert Global G2 TLS RSA SHA256 2020 CA1",
                     "assunto": "CN=*." + q, "de": "Jan 15 00:00:00 2026 GMT", "ate": "Jan 15 23:59:59 2027 GMT", "dias_restantes": 63, "sans": ["*." + q, q]},
             "web": {"cadeia": [{"url": f"https://{q}/", "status": 200}], "final": f"https://{q}/", "status": 200, "titulo": "Example Domain",
                     "servidor": "ECS (nyd/D179)", "tecnologia": "", "formularios_senha": 0,
                     "cabecalhos_seguranca": {k: k in ("strict-transport-security", "x-content-type-options") for k in SEC_HEADERS}},
             "email": {"spf": "v=spf1 -all", "dmarc": "v=DMARC1; p=reject; sp=reject", "dmarc_politica": "reject"}}
        r["alertas"] = domain_alerts(r)
        return r
    if kind == "ip":
        return {"alvo": q, "quando": now(), "dns_reverso": "dns.google",
                "rede": {"nome": "GOGL", "faixa": "8.8.8.0 – 8.8.8.255", "pais": "US", "organizacao": "Google LLC", "tipo": "DIRECT ALLOCATION"},
                "exposicao": {"portas": [53, 443], "vulns": [], "tags": [], "hostnames": ["dns.google"], "cpes": []},
                "reputacao": {"fonte": "VirusTotal", "obs": "demonstração"}, "alertas": []}
    if kind == "url":
        host = urllib.parse.urlsplit(q).hostname or q
        a = [["alto", f"O domínio de destino foi registrado há 6 dias."], ["medio", "Palavras típicas de phishing no endereço: login, verificar, pix"],
             ["medio", "2 redirecionamentos até o destino."], ["medio", "A página final pede senha."]]
        return {"alvo": q, "quando": now(),
                "web": {"cadeia": [{"url": q, "status": 301}, {"url": "https://encurt.example/r/aX9", "status": 302},
                                   {"url": "https://banco-seguro-verificar-pix.example.top/login", "status": 200}],
                        "final": "https://banco-seguro-verificar-pix.example.top/login", "status": 200, "titulo": "Acesse sua conta",
                        "servidor": "nginx", "tecnologia": "PHP/8.1", "formularios_senha": 1, "cabecalhos_seguranca": {k: False for k in SEC_HEADERS}},
                "registro": {"registrar": "Registrar Barato Inc.", "criado": "2026-11-07", "idade_dias": 6},
                "reputacao": {"fonte": "VirusTotal", "obs": "demonstração"}, "alertas": a, "risco": risk(a)}
    if kind == "hash":
        return {"alvo": q, "tipo": {32: "MD5", 40: "SHA-1", 64: "SHA-256"}[len(q)], "quando": now(),
                "reputacao": {"fonte": "VirusTotal", "malicioso": 52, "suspeito": 3, "inofensivo": 0, "nao_detectado": 17},
                "malwarebazaar": {"fonte": "MalwareBazaar", "malware": "AgentTesla", "tipo": "exe", "visto_em": "2026-10-28 14:02:11", "tags": ["exe", "AgentTesla", "stealer"]},
                "alertas": [["alto", "VirusTotal: 52 antivírus marcaram como malicioso."], ["alto", "MalwareBazaar: amostra conhecida de AgentTesla."]]}
    return {}

# ---------------------------------------------------------------- HTTP

class Handler(http.server.BaseHTTPRequestHandler):
    server_version = "CapixFaro/1.0"

    def log_message(self, *a):
        pass

    def _send(self, code, body, ctype="application/json; charset=utf-8"):
        data = body if isinstance(body, bytes) else json.dumps(body, ensure_ascii=False, default=str).encode()
        self.send_response(code)
        for k, v in (("Content-Type", ctype), ("Content-Length", str(len(data))), ("Cache-Control", "no-store"),
                     ("X-Content-Type-Options", "nosniff"), ("Referrer-Policy", "no-referrer"),
                     ("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'")):
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(data)

    def _route(self):
        if self.headers.get("Host", "") not in (f"127.0.0.1:{self.server.server_port}", f"localhost:{self.server.server_port}"):
            return None
        parts = urllib.parse.urlsplit(self.path).path.split("/", 2)
        if len(parts) < 2 or not secrets.compare_digest(parts[1], TOKEN):
            return None
        return "/" + (parts[2] if len(parts) > 2 else "")

    def do_GET(self):
        r = self._route()
        if r is None:
            return self._send(403, {"erro": "proibido"})
        if r in ("/", "/index.html"):
            html = open(os.path.join(WEB, "index.html"), encoding="utf-8").read().replace("__FARO_DRY__", "true" if DRY else "false")
            return self._send(200, html.encode(), "text/html; charset=utf-8")
        if r == "/assets/logo.png":
            p = os.environ.get("FARO_LOGO", "/usr/share/pixmaps/capix-logo.png")
            return self._send(200, open(p, "rb").read(), "image/png") if os.path.exists(p) else self._send(404, {})
        if r == "/api/casos":
            return self._send(200, cases_list())
        if r == "/api/config":
            c = load_cfg()
            return self._send(200, {k: bool(c.get(k)) for k in ("virustotal", "abusech")})
        return self._send(404, {"erro": "não encontrado"})

    def do_POST(self):
        r = self._route()
        if r is None:
            return self._send(403, {"erro": "proibido"})
        if not self.headers.get("Content-Type", "").startswith("application/json"):
            return self._send(400, {"erro": "pedido inválido"})
        try:
            n = int(self.headers.get("Content-Length", "0"))
            if n > MAX_FILE * 1.4:
                raise ValueError("pedido grande demais")
            b = json.loads(self.rfile.read(n) or b"{}")
            q = str(b.get("q", ""))
            if r == "/api/dominio":
                return self._send(200, mod_domain(q))
            if r == "/api/ip":
                return self._send(200, mod_ip(q))
            if r == "/api/link":
                return self._send(200, mod_url(q))
            if r == "/api/hash":
                return self._send(200, mod_hash(q))
            if r == "/api/email":
                return self._send(200, mod_email(q))
            if r == "/api/iocs":
                return self._send(200, {"iocs": extract_iocs(q), "defang": {k: [defang(x) for x in v] for k, v in extract_iocs(q).items() if k in ("url", "domain", "ipv4", "email")}})
            if r == "/api/arquivo":
                return self._send(200, mod_file(str(b.get("nome", "arquivo"))[:200], base64.b64decode(b.get("dados", ""))))
            if r == "/api/casos":
                return self._send(200, case_action(b))
            if r == "/api/config":
                c = load_cfg()
                for k in ("virustotal", "abusech"):
                    if k in b:
                        v = str(b[k]).strip()
                        if v:
                            c[k] = v[:200]
                        else:
                            c.pop(k, None)
                save_cfg(c)
                return self._send(200, {k: bool(c.get(k)) for k in ("virustotal", "abusech")})
            return self._send(404, {"erro": "não encontrado"})
        except (ValueError, KeyError, FileNotFoundError, json.JSONDecodeError) as e:
            return self._send(400, {"erro": str(e) or "pedido inválido"})
        except Exception as e:
            return self._send(500, {"erro": f"falha: {e}"})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=0)
    ap.add_argument("--no-browser", action="store_true")
    a = ap.parse_args()
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", a.port), Handler)
    url = f"http://127.0.0.1:{srv.server_port}/{TOKEN}/"
    print(url, flush=True)
    if not a.no_browser:
        browser = shutil.which("chromium-browser") or shutil.which("chromium")
        if browser:
            prof = os.path.join(HOME, ".cache/capix-faro")
            p = subprocess.Popen([browser, f"--app={url}", f"--user-data-dir={prof}", "--no-first-run", "--window-size=1200,780", "--class=CapixFaro"])
            threading.Thread(target=lambda: (p.wait(), srv.shutdown()), daemon=True).start()
    srv.serve_forever()


if __name__ == "__main__":
    main()
