// Notificação por e-mail (opcional). Só é usada se as variáveis SMTP_* existirem.
// Sem elas, o site apenas mostra os cadastros pendentes no painel /admin.
const nodemailer = require("nodemailer");

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, ADMIN_EMAIL } = process.env;
let transporter = null;

if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

const enabled = () => !!transporter;

async function notifyNewSignup(user) {
  if (!transporter || !ADMIN_EMAIL) return;
  try {
    await transporter.sendMail({
      from: SMTP_USER,
      to: ADMIN_EMAIL,
      subject: "Capix — novo cadastro aguardando aprovação",
      text:
        `Um novo usuário se cadastrou e aguarda aprovação:\n\n` +
        `Nome:  ${user.name || "-"}\n` +
        `E-mail: ${user.email}\n` +
        (user.note ? `Obs.:  ${user.note}\n` : "") +
        `\nAprove em: ${process.env.PUBLIC_URL || ""}/admin\n`,
    });
  } catch (e) {
    console.error("[capix] falha ao enviar e-mail de notificação:", e.message);
  }
}

module.exports = { enabled, notifyNewSignup };
