// Capix Linux OS — site de apresentação com cadastro, login e aprovação.
// Páginas públicas + área de download liberada só para usuários aprovados,
// e um painel /admin onde o dono aprova/recusa os cadastros.
const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");

const db = require("./db");
const mailer = require("./mailer");
const P = require("./pages");

const app = express();
const PORT = process.env.PORT || 8080;

// Segredo dos cookies de sessão. Defina JWT_SECRET no Railway para que as
// sessões sobrevivam a reinícios; sem ele, geramos um temporário.
const JWT_SECRET = process.env.JWT_SECRET || require("crypto").randomBytes(32).toString("hex");
if (!process.env.JWT_SECRET) console.warn("[capix] JWT_SECRET ausente — usando um segredo temporário (sessões caem a cada reinício).");

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const adminConfigured = () => ADMIN_EMAIL && ADMIN_PASSWORD;

// Política de privacidade / termo de consentimento (LGPD/GDPR).
const TERMS_VERSION = process.env.TERMS_VERSION || "1.1";
const TERMS_DATE = process.env.TERMS_DATE || "15/11/2026";
const CONTROLLER_NAME = process.env.CONTROLLER_NAME || "UnbugSTI (UnbugSolutions-TI)";
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || "contato@exemplo.com";

const COOKIE = {
  httpOnly: true,
  sameSite: "strict",
  secure: !process.env.COOKIE_INSECURE,
  maxAge: 7 * 24 * 3600 * 1000,
  path: "/",
};

app.set("trust proxy", 1);
app.use(cookieParser());
app.use(express.urlencoded({ extended: false, limit: "32kb" }));
app.use(express.json({ limit: "8kb" }));

// Cabeçalhos de segurança básicos.
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "DENY");
  next();
});

// Defesa simples contra CSRF: em POST, a origem precisa ser o próprio site.
function sameOrigin(req, res, next) {
  const origin = req.get("origin") || req.get("referer") || "";
  if (!origin) return next(); // alguns navegadores omitem; SameSite=strict já protege
  try {
    if (new URL(origin).host === req.get("host")) return next();
  } catch (_) {}
  return res.status(403).send("Origem inválida.");
}

const signUser = (id) => jwt.sign({ uid: id }, JWT_SECRET, { expiresIn: "7d" });
const signAdmin = () => jwt.sign({ adm: true }, JWT_SECRET, { expiresIn: "2d" });

async function currentUser(req) {
  const t = req.cookies.capix_user;
  if (!t || !db.hasDb()) return null;
  try {
    const { uid } = jwt.verify(t, JWT_SECRET);
    return await db.getUserById(uid);
  } catch (_) { return null; }
}

function isAdmin(req) {
  const t = req.cookies.capix_admin;
  if (!t) return false;
  try { return !!jwt.verify(t, JWT_SECRET).adm; } catch (_) { return false; }
}

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 40, standardHeaders: true, legacyHeaders: false });
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------- Cadastro ----------
app.get("/cadastro", (req, res) => {
  if (!db.hasDb()) return res.send(P.unavailablePage());
  res.send(P.registerPage());
});

app.post("/cadastro", limiter, sameOrigin, async (req, res) => {
  if (!db.hasDb()) return res.send(P.unavailablePage());
  const name = (req.body.name || "").trim();
  const email = (req.body.email || "").trim().toLowerCase();
  const password = req.body.password || "";
  const note = (req.body.note || "").trim();
  const consent = req.body.consent === "on";
  const values = { name, email };
  if (!name || !emailRe.test(email) || password.length < 8)
    return res.status(400).send(P.registerPage({ error: "Confira os campos: nome, e-mail válido e senha de 8+ caracteres.", values }));
  if (!consent)
    return res.status(400).send(P.registerPage({ error: "Para criar a conta, é preciso ler e aceitar a Política de Privacidade.", values }));
  try {
    if (await db.getUserByEmail(email))
      return res.status(409).send(P.registerPage({ error: "Já existe uma conta com esse e-mail. Faça login.", values }));
    const hash = await bcrypt.hash(password, 12);
    const ip = ((req.headers["x-forwarded-for"] || "").split(",")[0].trim()) || req.ip || "";
    const ua = (req.get("user-agent") || "").slice(0, 400);
    const user = await db.createUser({
      email, name, note, hash,
      termsVersion: TERMS_VERSION, consentIp: ip, consentUserAgent: ua,
    });
    mailer.notifyNewSignup({ ...user, note }).catch(() => {});
    res.cookie("capix_user", signUser(user.id), COOKIE);
    res.send(P.pendingPage(user));
  } catch (e) {
    console.error("[capix] erro no cadastro:", e.message);
    res.status(500).send(P.registerPage({ error: "Erro ao criar a conta. Tente novamente.", values }));
  }
});

// ---------- Política de privacidade ----------
app.get(["/privacidade", "/termos"], (req, res) => {
  res.send(P.privacyPage({
    controller: CONTROLLER_NAME, contact: CONTACT_EMAIL,
    version: TERMS_VERSION, date: TERMS_DATE,
  }));
});

// ---------- Login ----------
app.get("/login", async (req, res) => {
  if (!db.hasDb()) return res.send(P.unavailablePage());
  const u = await currentUser(req);
  if (u) return res.redirect("/download");
  res.send(P.loginPage());
});

app.post("/login", limiter, sameOrigin, async (req, res) => {
  if (!db.hasDb()) return res.send(P.unavailablePage());
  const email = (req.body.email || "").trim().toLowerCase();
  const password = req.body.password || "";
  const values = { email };
  try {
    const user = await db.getUserByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.password_hash)))
      return res.status(401).send(P.loginPage({ error: "E-mail ou senha incorretos.", values }));
    res.cookie("capix_user", signUser(user.id), COOKIE);
    res.redirect("/download");
  } catch (e) {
    console.error("[capix] erro no login:", e.message);
    res.status(500).send(P.loginPage({ error: "Erro ao entrar. Tente novamente.", values }));
  }
});

app.get("/logout", (req, res) => {
  res.clearCookie("capix_user", { path: "/" });
  res.redirect("/");
});

// ---------- Área de download (protegida) ----------
app.get("/download.html", (req, res) => res.redirect("/download"));

app.get("/download", async (req, res) => {
  const u = await currentUser(req);
  if (!u) return res.redirect("/login");
  if (u.status === "approved") {
    res.setHeader("Cache-Control", "no-store");
    return res.sendFile(path.join(__dirname, "protected", "download.html"));
  }
  if (u.status === "rejected") return res.send(P.rejectedPage(u));
  return res.send(P.pendingPage(u));
});

// ---------- Admin ----------
app.get("/admin/login", (req, res) => {
  if (!adminConfigured()) return res.send(P.adminDisabledPage());
  if (isAdmin(req)) return res.redirect("/admin");
  res.send(P.adminLoginPage());
});

app.post("/admin/login", limiter, sameOrigin, (req, res) => {
  if (!adminConfigured()) return res.send(P.adminDisabledPage());
  const email = (req.body.email || "").trim().toLowerCase();
  const password = req.body.password || "";
  const ok = email === ADMIN_EMAIL && password === ADMIN_PASSWORD;
  if (!ok) return res.status(401).send(P.adminLoginPage({ error: "Credenciais de admin inválidas." }));
  res.cookie("capix_admin", signAdmin(), COOKIE);
  res.redirect("/admin");
});

app.get("/admin/logout", (req, res) => {
  res.clearCookie("capix_admin", { path: "/" });
  res.redirect("/admin/login");
});

function requireAdmin(req, res, next) {
  if (!adminConfigured()) return res.send(P.adminDisabledPage());
  if (!isAdmin(req)) return res.redirect("/admin/login");
  if (!db.hasDb()) return res.send(P.unavailablePage());
  next();
}

app.get("/admin", requireAdmin, async (req, res) => {
  try {
    const [pending, approved, rejected] = await Promise.all([
      db.listByStatus("pending"), db.listByStatus("approved"), db.listByStatus("rejected"),
    ]);
    res.send(P.adminPage({ pending, approved, rejected }));
  } catch (e) {
    console.error("[capix] erro no painel:", e.message);
    res.status(500).send("Erro ao carregar o painel.");
  }
});

async function decide(req, res, status) {
  const id = parseInt(req.body.id, 10);
  if (!Number.isInteger(id)) return res.status(400).send("id inválido");
  try { await db.setStatus(id, status); res.redirect("/admin"); }
  catch (e) { console.error("[capix] erro ao decidir:", e.message); res.status(500).send("Erro."); }
}
app.post("/admin/approve", requireAdmin, sameOrigin, (req, res) => decide(req, res, "approved"));
app.post("/admin/reject", requireAdmin, sameOrigin, (req, res) => decide(req, res, "rejected"));

// ---------- API de ativação (consumida pelo Capix OS na instalação) ----------
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });

app.post("/api/verify", apiLimiter, async (req, res) => {
  if (!db.hasDb()) return res.status(503).json({ ok: false, reason: "servico indisponivel" });
  const email = (req.body.email || "").trim().toLowerCase();
  const password = req.body.password || "";
  if (!emailRe.test(email) || !password)
    return res.status(400).json({ ok: false, reason: "dados invalidos" });
  try {
    const user = await db.getUserByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.password_hash)))
      return res.status(401).json({ ok: false, reason: "credenciais invalidas" });
    if (user.status !== "approved")
      return res.status(403).json({
        ok: false,
        reason: user.status === "pending" ? "aguardando aprovacao" : "acesso nao liberado",
        status: user.status,
      });
    db.touchActivation(user.id).catch(() => {});
    return res.json({ ok: true, name: user.name || "", email: user.email });
  } catch (e) {
    console.error("[capix] erro no /api/verify:", e.message);
    return res.status(500).json({ ok: false, reason: "erro interno" });
  }
});

// ---------- Site estático (público) ----------
app.use(express.static(path.join(__dirname, "public"), {
  index: "index.html",
  setHeaders: (res) => res.setHeader("Cache-Control", "public, max-age=3600"),
}));

app.get("/healthz", (req, res) => res.json({ ok: true, db: db.hasDb() }));

// ---------- Início ----------
db.init()
  .catch((e) => console.error("[capix] erro ao iniciar o banco:", e.message))
  .finally(() => {
    app.listen(PORT, () => console.log(`[capix] site no ar na porta ${PORT} (db=${db.hasDb()}, admin=${adminConfigured()}, email=${mailer.enabled()})`));
  });
