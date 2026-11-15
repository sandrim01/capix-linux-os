# Site de apresentação do Capix Linux OS (estático, servido pelo Caddy)
FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY index.html download.html preview.html /srv/
COPY assets /srv/assets
EXPOSE 8080
