// Páginas HTML do fluxo de acesso (login, cadastro, aguardando, admin),
// com a mesma identidade visual do site (tema escuro + laranja + capivara).

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0f0f11;--bg2:#151517;--card:#1b1b1d;--card2:#202023;
  --line:#2a2a2e;--line2:#333338;--tx:#f2f2f2;--tx2:#d0d0d4;--tx3:#a9a9b0;
  --orange:#F68B2C;--orange-soft:#ffb23d;--coral:#ff6b5b;--green:#6BB33F;--red:#ff6b5b;
  --radius:16px;--font:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
}
body{font-family:var(--font);background:var(--bg);color:var(--tx);line-height:1.6;-webkit-font-smoothing:antialiased;min-height:100vh}
a{color:var(--orange);text-decoration:none}a:hover{color:var(--orange-soft)}
.top{display:flex;align-items:center;justify-content:space-between;height:64px;padding:0 24px;border-bottom:1px solid var(--line);background:rgba(15,15,17,.72);backdrop-filter:blur(12px);position:sticky;top:0;z-index:10}
.brand{display:flex;align-items:center;gap:12px;font-weight:700;font-size:17px;color:var(--tx)}
.brand img{width:34px;height:34px;border-radius:9px}
.accent{color:var(--orange)}
.wrap{max-width:460px;margin:0 auto;padding:48px 24px}
.wide{max-width:960px}
.card{background:linear-gradient(180deg,var(--card2),var(--card));border:1px solid var(--line);border-radius:var(--radius);padding:32px}
h1{font-size:26px;font-weight:800;letter-spacing:-.02em;margin-bottom:6px}
.sub{color:var(--tx3);font-size:15px;margin-bottom:26px}
label{display:block;font-size:13px;font-weight:600;color:var(--tx2);margin:16px 0 7px}
input,textarea{width:100%;background:var(--bg2);border:1px solid var(--line2);border-radius:11px;padding:12px 14px;color:var(--tx);font-family:inherit;font-size:15px}
input:focus,textarea:focus{outline:none;border-color:var(--orange)}
textarea{resize:vertical;min-height:72px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;padding:13px 20px;border-radius:11px;font-weight:600;font-size:15px;cursor:pointer;border:1px solid transparent;transition:transform .12s,background .15s,border-color .15s;width:100%;margin-top:22px;font-family:inherit}
.btn:active{transform:translateY(1px)}
.btn-primary{background:var(--orange);color:#1b120d}.btn-primary:hover{background:var(--orange-soft)}
.btn-sm{width:auto;margin:0;padding:9px 16px;font-size:14px}
.btn-ok{background:var(--green);color:#0d1a05}
.btn-no{background:transparent;border-color:var(--line2);color:var(--tx2)}.btn-no:hover{border-color:var(--red);color:var(--red)}
.alt{text-align:center;margin-top:22px;font-size:14px;color:var(--tx3)}
.msg{padding:12px 15px;border-radius:11px;font-size:14px;margin-bottom:20px}
.msg.err{background:rgba(255,107,91,.1);border:1px solid rgba(255,107,91,.3);color:#ffb3aa}
.msg.ok{background:rgba(107,179,63,.12);border:1px solid rgba(107,179,63,.35);color:#bfe8a0}
.msg.info{background:rgba(246,139,44,.1);border:1px solid rgba(246,139,44,.3);color:var(--orange-soft)}
.badge{display:inline-flex;align-items:center;gap:7px;font-size:13px;font-weight:700;background:rgba(246,139,44,.14);color:var(--orange-soft);border:1px solid rgba(246,139,44,.3);padding:5px 12px;border-radius:999px}
table{width:100%;border-collapse:collapse;margin-top:14px}
th,td{text-align:left;padding:12px 10px;border-bottom:1px solid var(--line);font-size:14px;vertical-align:top}
th{color:var(--tx3);font-size:12px;text-transform:uppercase;letter-spacing:.05em}
td .em{color:var(--tx);font-weight:600}
td .mut{color:var(--tx3);font-size:13px}
.row-actions{display:flex;gap:8px}
.empty{color:var(--tx3);padding:22px 0;text-align:center}
.tabs{display:flex;gap:10px;margin:22px 0 4px}
.tab{padding:8px 14px;border-radius:10px;border:1px solid var(--line2);color:var(--tx2);font-size:14px;font-weight:600;cursor:pointer}
.tab.on{background:var(--orange);color:#1b120d;border-color:transparent}
.pill{font-size:12px;font-weight:700;padding:3px 9px;border-radius:999px}
.pill.pending{background:rgba(246,139,44,.15);color:var(--orange-soft)}
.pill.approved{background:rgba(107,179,63,.15);color:#bfe8a0}
.pill.rejected{background:rgba(255,107,91,.12);color:#ffb3aa}
.foot{text-align:center;color:var(--tx3);font-size:13px;padding:30px 0}
.consent{display:flex;gap:10px;align-items:flex-start;margin-top:20px;font-size:13.5px;color:var(--tx2);line-height:1.5}
.consent input{width:18px;height:18px;margin-top:2px;accent-color:var(--orange);flex:0 0 auto}
.policy h2{font-size:18px;margin:26px 0 8px}
.policy h1{margin-bottom:4px}
.policy p,.policy li{color:var(--tx2);font-size:14.5px;margin-top:8px}
.policy ul{margin:4px 0 4px 20px}
.policy .meta{color:var(--tx3);font-size:13px;margin-bottom:18px}
.policy code{background:var(--bg2);padding:2px 6px;border-radius:6px;font-size:13px}
`;

function layout(title, body, { wide = false } = {}) {
  return `<!DOCTYPE html><html lang="pt-BR"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)} — Capix Linux OS</title>
<link rel="icon" type="image/png" href="/assets/logo.png">
<style>${CSS}</style></head><body>
<div class="top">
  <a class="brand" href="/"><img src="/assets/logo.png" alt="Capix">Capix<span class="accent">OS</span><span style="font-size:11px;font-weight:700;color:var(--orange-soft);border:1px solid rgba(246,139,44,.45);padding:2px 8px;border-radius:999px;margin-left:8px;letter-spacing:.04em">BETA</span></a>
  <a href="/" style="color:var(--tx3);font-size:14px">← Voltar ao site</a>
</div>
<div class="wrap ${wide ? "wide" : ""}">${body}</div>
<div class="foot">Capix Linux OS · UnbugSTI</div>
</body></html>`;
}

const msg = (type, text) => text ? `<div class="msg ${type}">${esc(text)}</div>` : "";

function registerPage({ error = "", values = {} } = {}) {
  return layout("Criar conta", `
    <div class="card">
      <h1>Criar conta</h1>
      <p class="sub">Cadastre-se para pedir acesso aos downloads do Capix. Seu acesso é liberado após aprovação.</p>
      ${msg("err", error)}
      <form method="post" action="/cadastro">
        <label>Nome</label>
        <input name="name" value="${esc(values.name)}" maxlength="80" required>
        <label>E-mail</label>
        <input name="email" type="email" value="${esc(values.email)}" maxlength="120" required>
        <label>Senha <span style="color:var(--tx3);font-weight:400">(mínimo 8 caracteres)</span></label>
        <input name="password" type="password" minlength="8" maxlength="200" required>
        <label>Para que vai usar? <span style="color:var(--tx3);font-weight:400">(opcional)</span></label>
        <textarea name="note" maxlength="500" placeholder="Ex.: testar em um notebook antigo"></textarea>
        <label class="consent">
          <input type="checkbox" name="consent" value="on" required>
          <span>Li e concordo com a <a href="/privacidade" target="_blank" rel="noopener">Política de Privacidade e o Termo de Consentimento</a>, e autorizo o tratamento dos meus dados para as finalidades ali descritas, nos termos da LGPD.</span>
        </label>
        <button class="btn btn-primary" type="submit">Criar conta</button>
      </form>
      <p class="alt">Já tem conta? <a href="/login">Entrar</a></p>
    </div>`);
}

function loginPage({ error = "", info = "", values = {} } = {}) {
  return layout("Entrar", `
    <div class="card">
      <h1>Entrar</h1>
      <p class="sub">Acesse sua conta para baixar o Capix.</p>
      ${msg("err", error)}${msg("info", info)}
      <form method="post" action="/login">
        <label>E-mail</label>
        <input name="email" type="email" value="${esc(values.email)}" maxlength="120" required>
        <label>Senha</label>
        <input name="password" type="password" maxlength="200" required>
        <button class="btn btn-primary" type="submit">Entrar</button>
      </form>
      <p class="alt">Não tem conta? <a href="/cadastro">Criar conta</a></p>
    </div>`);
}

function pendingPage(user) {
  return layout("Aguardando aprovação", `
    <div class="card" style="text-align:center">
      <div style="font-size:42px;margin-bottom:8px">🦫⏳</div>
      <h1>Cadastro recebido!</h1>
      <p class="sub">Olá, ${esc(user.name || user.email)}. Sua conta está <b>aguardando aprovação</b>. Assim que for liberada, a área de download aparece aqui.</p>
      <div class="msg info">Você será aprovado manualmente pela administração do Capix. Volte mais tarde e entre de novo para checar.</div>
      <a class="btn btn-no btn-sm" href="/logout" style="width:auto;display:inline-flex">Sair</a>
    </div>`);
}

function rejectedPage(user) {
  return layout("Acesso não liberado", `
    <div class="card" style="text-align:center">
      <h1>Acesso não liberado</h1>
      <p class="sub">Olá, ${esc(user.name || user.email)}. No momento seu acesso aos downloads não foi liberado.</p>
      <a class="btn btn-no btn-sm" href="/logout" style="width:auto;display:inline-flex">Sair</a>
    </div>`);
}

function unavailablePage() {
  return layout("Indisponível", `
    <div class="card" style="text-align:center">
      <h1>Login indisponível</h1>
      <p class="sub">O cadastro e login ainda não estão configurados neste servidor. Tente novamente mais tarde.</p>
      <a class="btn btn-primary btn-sm" href="/" style="width:auto;display:inline-flex">Voltar ao site</a>
    </div>`);
}

function adminLoginPage({ error = "" } = {}) {
  return layout("Admin", `
    <div class="card">
      <h1>Administração</h1>
      <p class="sub">Acesso restrito ao dono do Capix.</p>
      ${msg("err", error)}
      <form method="post" action="/admin/login">
        <label>E-mail do admin</label>
        <input name="email" type="email" maxlength="120" required>
        <label>Senha</label>
        <input name="password" type="password" maxlength="200" required>
        <button class="btn btn-primary" type="submit">Entrar</button>
      </form>
    </div>`);
}

function adminDisabledPage() {
  return layout("Admin", `
    <div class="card">
      <h1>Admin não configurado</h1>
      <p class="sub">Defina as variáveis <code>ADMIN_EMAIL</code> e <code>ADMIN_PASSWORD</code> no Railway para habilitar o painel.</p>
    </div>`);
}

function userRow(u, showActions) {
  const when = new Date(u.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const actions = showActions ? `
      <td><div class="row-actions">
        <form method="post" action="/admin/approve"><input type="hidden" name="id" value="${u.id}"><button class="btn btn-ok btn-sm" type="submit">Aprovar</button></form>
        <form method="post" action="/admin/reject"><input type="hidden" name="id" value="${u.id}"><button class="btn btn-no btn-sm" type="submit">Recusar</button></form>
      </div></td>` : `<td><span class="pill ${u.status}">${u.status === "approved" ? "aprovado" : u.status === "rejected" ? "recusado" : "pendente"}</span></td>`;
  let consent = "";
  if (u.terms_version) {
    const at = u.terms_accepted_at ? new Date(u.terms_accepted_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—";
    consent = `<br><span class="mut" style="color:#8fb86a">✔ consentimento ${esc(u.terms_version)} · ${esc(at)}${u.consent_ip ? " · IP " + esc(u.consent_ip) : ""}</span>`;
  } else {
    consent = `<br><span class="mut" style="color:#caa">sem registro de consentimento</span>`;
  }
  return `<tr>
    <td><span class="em">${esc(u.name || "—")}</span><br><span class="mut">${esc(u.email)}</span>${u.note ? `<br><span class="mut">“${esc(u.note)}”</span>` : ""}${consent}</td>
    <td class="mut">${esc(when)}</td>
    ${actions}
  </tr>`;
}

function adminPage({ pending, approved, rejected }) {
  const section = (title, rows, showActions) => `
    <h1 style="font-size:19px;margin-top:26px">${title} <span class="mut" style="font-size:14px">(${rows.length})</span></h1>
    ${rows.length ? `<table><thead><tr><th>Usuário</th><th>Cadastro</th><th>${showActions ? "Ações" : "Status"}</th></tr></thead>
      <tbody>${rows.map((u) => userRow(u, showActions)).join("")}</tbody></table>`
      : `<div class="empty">Nenhum.</div>`}`;
  return layout("Painel de administração", `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
      <h1>Painel de administração</h1>
      <div style="display:flex;gap:12px;align-items:center">
        ${pending.length ? `<span class="badge">🔔 ${pending.length} aguardando</span>` : `<span class="mut">Sem pendências</span>`}
        <a class="btn btn-no btn-sm" href="/admin/logout" style="width:auto;display:inline-flex">Sair</a>
      </div>
    </div>
    ${section("Aguardando aprovação", pending, true)}
    ${section("Aprovados", approved, false)}
    ${section("Recusados", rejected, false)}
  `, { wide: true });
}

function privacyPage({ controller, contact, version, date }) {
  return layout("Política de Privacidade", `
    <div class="card policy">
      <h1>Política de Privacidade e Termo de Consentimento</h1>
      <p class="meta">Versão ${esc(version)} · atualizada em ${esc(date)}</p>

      <p>Esta Política explica como o <b>${esc(controller)}</b> (“nós”), responsável pelo <b>Capix Linux OS</b>, trata os dados pessoais de quem se cadastra para acessar a área de download, em conformidade com a <b>Lei Geral de Proteção de Dados</b> (Lei nº 13.709/2018 — LGPD) e alinhado ao <b>GDPR</b> (Regulamento (UE) 2016/679).</p>

      <h2>1. Controlador e contato</h2>
      <p>Controlador dos dados: <b>${esc(controller)}</b>. Para dúvidas ou para exercer seus direitos, fale com o encarregado pelo tratamento de dados (DPO) em <code>${esc(contact)}</code>.</p>

      <h2>2. Dados que coletamos</h2>
      <ul>
        <li>Nome e e-mail que você informa no cadastro;</li>
        <li>Senha, armazenada apenas de forma criptografada (hash bcrypt) — nunca em texto puro;</li>
        <li>Finalidade de uso (campo opcional que você pode preencher);</li>
        <li>Dados do aceite deste termo: data e hora, versão aceita, endereço IP e navegador (user-agent), para fins de comprovação do consentimento.</li>
      </ul>

      <h2>3. Para que usamos</h2>
      <p>Usamos seus dados apenas para criar e gerenciar seu cadastro, analisar e aprovar seu pedido de acesso, e liberar o download do Capix. Não usamos seus dados para publicidade nem os vendemos.</p>

      <h2>4. Base legal</h2>
      <p>O tratamento se baseia no seu <b>consentimento</b> (art. 7º, I, da LGPD) e, no que for necessário à segurança do serviço, no <b>legítimo interesse</b> (art. 7º, IX).</p>

      <h2>5. Compartilhamento</h2>
      <p>Não compartilhamos seus dados com terceiros para fins próprios deles. Utilizamos provedores de infraestrutura e hospedagem que processam os dados em nosso nome e seguindo nossas instruções.</p>

      <h2>6. Segurança e retenção</h2>
      <p>Adotamos medidas técnicas para proteger seus dados (senhas com hash, acesso restrito ao painel administrativo). Mantemos seus dados enquanto sua conta existir ou enquanto durar a finalidade; depois disso, eles são eliminados ou anonimizados.</p>

      <h2>7. Seus direitos</h2>
      <p>A qualquer momento você pode solicitar: confirmação e acesso aos seus dados, correção, anonimização ou eliminação, portabilidade, informação sobre compartilhamentos e <b>revogação do consentimento</b> (art. 18 da LGPD; direitos equivalentes no GDPR). Basta escrever para <code>${esc(contact)}</code>.</p>

      <h2>8. Transferência internacional</h2>
      <p>Caso os dados sejam processados fora do seu país (por provedores de hospedagem), adotamos salvaguardas compatíveis com a LGPD e o GDPR.</p>

      <h2>9. Alterações</h2>
      <p>Podemos atualizar esta Política. A versão vigente é identificada pelo número e pela data no topo desta página.</p>

      <h2>10. Consentimento</h2>
      <p>Ao marcar a caixa de aceite e concluir o cadastro, você declara ter lido e concordado com esta Política e autoriza o tratamento dos seus dados para as finalidades aqui descritas. Registramos a versão, a data/hora, o IP e o navegador do seu aceite como prova do consentimento.</p>

      <p style="margin-top:26px"><a href="/cadastro">← Voltar ao cadastro</a></p>
    </div>`, { wide: true });
}

module.exports = {
  esc, layout, registerPage, loginPage, pendingPage, rejectedPage,
  unavailablePage, adminLoginPage, adminDisabledPage, adminPage, privacyPage,
};
