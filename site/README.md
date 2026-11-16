# Site do Capix Linux OS

Site de apresentação com **cadastro, login e aprovação de acesso** à área de download.
Node/Express + PostgreSQL, pronto para o Railway (Docker).

## Como funciona

1. Visitante clica em **Baixar** → vai para **/login** (ou **/cadastro**).
2. Ao se cadastrar, a conta fica **pendente**.
3. O dono entra em **/admin**, vê os cadastros pendentes e **aprova** ou **recusa**.
4. Só depois de aprovado o usuário vê a **página de download** (`/download`).

## Variáveis de ambiente (no Railway)

Obrigatórias para o login funcionar:

| Variável | Para quê |
|---|---|
| `DATABASE_URL` | Banco PostgreSQL. **Adicione um Postgres no projeto** que o Railway injeta esta variável automaticamente. |
| `ADMIN_EMAIL` | E-mail do admin (login do painel `/admin`). |
| `ADMIN_PASSWORD` | Senha do admin. |
| `JWT_SECRET` | Segredo das sessões. Use um texto longo e aleatório. Sem ele, as sessões caem a cada reinício. |

Opcionais (notificação por e-mail de novos cadastros):

| Variável | Para quê |
|---|---|
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Servidor de e-mail. Se definidos, o admin recebe um e-mail a cada novo cadastro. |
| `PUBLIC_URL` | URL pública do site (usada no link do e-mail). |

Sem `DATABASE_URL` o site continua no ar em "modo vitrine" (páginas públicas funcionam; login mostra aviso).

## Rodar local

```
npm install
DATABASE_URL=postgres://... ADMIN_EMAIL=voce@exemplo.com ADMIN_PASSWORD=senha \
  JWT_SECRET=algo-aleatorio COOKIE_INSECURE=1 npm start
```

(`COOKIE_INSECURE=1` só no local, porque não há HTTPS.)

## Estrutura

- `server.js` — rotas (público, login/cadastro, download protegido, admin)
- `db.js` — PostgreSQL (tabela `users`)
- `pages.js` — páginas de login/cadastro/aguardando/admin (identidade do site)
- `mailer.js` — e-mail opcional
- `public/` — site público (landing, assets)
- `protected/download.html` — página de download (só aprovados)
