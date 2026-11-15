# Site de apresentação do Capix Linux OS

Site estático (uma página) com a identidade visual do Capix e os links de download.
Servido pelo **Caddy** dentro de um container — pronto para o **Railway**.

## Arquivos
- `index.html` — a página.
- `preview.html` — prévia interativa do sistema (boot → login → área de trabalho).
- `assets/` — logo, fundo e miniaturas.
- `Dockerfile` + `Caddyfile` — servidor estático (lê a porta de `$PORT`).
- `railway.json` — configuração do Railway (builder = Dockerfile).

## Publicar no Railway (passo a passo)
1. Em [railway.com](https://railway.com) → **New Project** → **Deploy from GitHub repo** → escolha `sandrim01/capix-linux-os`.
2. Abra o serviço criado → aba **Settings**:
   - **Root Directory**: `site`  ← importante, o site está nesta subpasta.
   - **Build**: o Railway detecta o `Dockerfile` automaticamente.
3. Aba **Settings → Networking** → **Generate Domain** (ou aponte um domínio seu).
4. Pronto: cada `git push` na `main` redeploya o site.

Não é preciso configurar porta: o Caddy usa a variável `$PORT` que o Railway injeta.

## Testar localmente
```bash
# com Docker/Podman
docker build -t capix-site . && docker run --rm -p 8080:8080 -e PORT=8080 capix-site
# ou sem Docker
python3 -m http.server 8080   # e abra http://localhost:8080
```

## Downloads
- **Imagem do sistema** (pública e permanente): `ghcr.io/sandrim01/capix:44` e `ghcr.io/sandrim01/capix-nvidia:44`.
- **ISO (~5 GB)**: hoje fica nos artefatos do GitHub Actions. Para um link direto e definitivo,
  publique a ISO no Internet Archive ou num bucket (Cloudflare R2) e troque as URLs dos botões
  `#dl-iso-amd` / `#dl-iso-nvidia` no `index.html`.
