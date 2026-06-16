# Stage 1: build frontend (Morph Studio)
FROM node:22-bookworm-slim AS frontend-builder
WORKDIR /app/web-frontend
COPY web-frontend/package.json ./
RUN npm install --no-audit --no-fund
COPY web-frontend/ .
RUN npm run build

# Stage 2: build backend (needs toolchain for better-sqlite3)
FROM node:22-bookworm AS backend-builder
WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install --no-audit --no-fund
COPY src/ ./src/
RUN npm run build

# Prune dev dependencies for a lean runtime node_modules.
RUN npm prune --omit=dev

# Stage 3: runtime
FROM node:22-bookworm-slim AS runtime

# VERSION is injected by CI from the release tag (defaults to "dev" for local builds).
# In CI, docker/metadata-action also adds the standard OCI labels automatically.
ARG VERSION=dev
LABEL org.opencontainers.image.title="morph" \
      org.opencontainers.image.description="MORPH — MCP Optimized Response Protocol Handler" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.source="https://github.com/wagner-sousa/morph"

# System deps commonly required by backend MCP servers (python, git, npx).
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 git ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

COPY --from=backend-builder /app/node_modules ./node_modules
COPY --from=backend-builder /app/dist ./dist
COPY package.json ./
COPY --from=frontend-builder /app/web-frontend/dist ./public

EXPOSE 3100

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node dist/healthcheck.js

# MORPH_TRANSPORT selects the agent-facing transport (stdio default).
ENV MORPH_TRANSPORT=stdio
ENTRYPOINT ["node", "dist/index.js", "start"]
