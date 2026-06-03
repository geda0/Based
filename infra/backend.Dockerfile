# Based backend (Fastify) container image for AWS App Runner.
# Build context = repo ROOT (so we can copy tsconfig.base.json + the backend workspace).
#   docker build -f infra/backend.Dockerfile -t <img> .
# The backend is self-contained (no workspace-internal deps) so a focused npm install works.
FROM node:22-slim
WORKDIR /app

# backend/tsconfig.json extends "../tsconfig.base.json"; place the base at /tsconfig.base.json
# so that ../ from /app resolves to it.
COPY tsconfig.base.json /tsconfig.base.json
COPY backend/package.json backend/tsconfig.json ./

# Install deps (incl. tsx, used to run the TS entrypoint directly — matches dev).
# NODE_ENV is NOT yet "production" on this layer, so devDependencies (tsx) are installed.
RUN npm install --no-audit --no-fund --loglevel=error

COPY backend/src ./src

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
# server.ts binds 0.0.0.0:$PORT and serves GET /health (App Runner health check).
CMD ["npx", "tsx", "src/server.ts"]
