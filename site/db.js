// Banco de dados (PostgreSQL) do site do Capix.
// Usa a variável DATABASE_URL (injetada pelo Railway ao adicionar um Postgres).
// Se não houver banco, o site continua no ar em "modo vitrine": as páginas
// públicas funcionam e as rotas de login mostram um aviso amigável.
const { Pool } = require("pg");

const url = process.env.DATABASE_URL || "";
let pool = null;

if (url) {
  const needSsl = /sslmode=require/i.test(url) || process.env.PGSSL === "require";
  pool = new Pool({
    connectionString: url,
    ssl: needSsl ? { rejectUnauthorized: false } : false,
    max: 5,
  });
}

const hasDb = () => !!pool;

async function init() {
  if (!pool) {
    console.warn("[capix] DATABASE_URL ausente — rodando em modo vitrine (sem cadastro/login).");
    return;
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      email         TEXT UNIQUE NOT NULL,
      name          TEXT,
      note          TEXT,
      password_hash TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'pending',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      decided_at    TIMESTAMPTZ
    );
  `);
  // Registro de consentimento (LGPD/GDPR): guarda a prova do aceite.
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_version TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_ip TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_user_agent TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_activation_at TIMESTAMPTZ`);
  console.log("[capix] banco pronto.");
}

async function createUser({ email, name, note, hash, termsVersion, consentIp, consentUserAgent }) {
  const r = await pool.query(
    `INSERT INTO users (email, name, note, password_hash, terms_version, terms_accepted_at, consent_ip, consent_user_agent)
     VALUES ($1, $2, $3, $4, $5, now(), $6, $7)
     RETURNING id, email, name, status, created_at`,
    [email, name, note, hash, termsVersion || null, consentIp || null, consentUserAgent || null]
  );
  return r.rows[0];
}

async function getUserByEmail(email) {
  const r = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);
  return r.rows[0] || null;
}

async function getUserById(id) {
  const r = await pool.query(`SELECT * FROM users WHERE id = $1`, [id]);
  return r.rows[0] || null;
}

async function listByStatus(status) {
  const r = await pool.query(
    `SELECT id, email, name, note, status, created_at, decided_at,
            terms_version, terms_accepted_at, consent_ip
     FROM users WHERE status = $1 ORDER BY created_at DESC`,
    [status]
  );
  return r.rows;
}

async function countPending() {
  const r = await pool.query(`SELECT COUNT(*)::int AS n FROM users WHERE status = 'pending'`);
  return r.rows[0].n;
}

async function setStatus(id, status) {
  await pool.query(`UPDATE users SET status = $1, decided_at = now() WHERE id = $2`, [status, id]);
}

async function touchActivation(id) {
  await pool.query(`UPDATE users SET last_activation_at = now() WHERE id = $1`, [id]);
}

module.exports = {
  hasDb, init, createUser, getUserByEmail, getUserById,
  listByStatus, countPending, setStatus, touchActivation,
};
