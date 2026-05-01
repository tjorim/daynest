FROM node:25-alpine AS development-dependencies-env
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci

FROM node:25-alpine AS build-env
WORKDIR /app
COPY frontend/ ./
COPY --from=development-dependencies-env /app/node_modules ./node_modules
RUN npm run build

FROM caddy:2-alpine
COPY --from=build-env /app/dist /srv
COPY deploy/Caddyfile /etc/caddy/Caddyfile
