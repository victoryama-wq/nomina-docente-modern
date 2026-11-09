FROM node:24-slim AS deps
RUN npm install --global npm@10.9.4 --no-audit --no-fund
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --workspace apps/api --include-workspace-root --ignore-scripts --no-audit --no-fund

FROM node:24-slim AS build
RUN npm install --global npm@10.9.4 --no-audit --no-fund
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY apps/api ./apps/api
RUN npm --workspace apps/api run build

FROM node:24-slim AS runtime
RUN npm install --global npm@10.9.4 --no-audit --no-fund
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY apps/api/package.json apps/api/package.json
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
# Only basic envelope validation is part of the current document flow.
CMD ["node", "apps/api/dist/server.js"]
