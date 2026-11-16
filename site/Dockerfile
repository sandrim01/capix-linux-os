# Site do Capix Linux OS — Node/Express (cadastro, login, aprovação e downloads).
FROM node:20-alpine
WORKDIR /app

# Instala só as dependências de produção (melhor cache de build)
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Copia o restante do app
COPY . .

ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "server.js"]
