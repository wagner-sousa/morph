# Development

MORPH follows **Specification-Driven Development (SDD)**: write the contract
(types/schema) first, then a failing test, then the implementation.

```mermaid
flowchart LR
    A[types.ts / schema.ts] -->|spec| B[*.test.ts]
    B -->|failing test| C[*.ts impl]
    C -->|passes| D[Done]
    B -.->|fails| C
```

## Everything runs in Docker

No local Node toolchain is needed.

```bash
# Install + test (124+ tests across 16 test files)
docker run --rm -v "$PWD":/app -w /app node:22 sh -c "npm install && npm test"

# Typecheck
docker run --rm -v "$PWD":/app -w /app node:22 sh -c "npm install && npm run typecheck"

# Build (emits dist/)
docker run --rm -v "$PWD":/app -w /app node:22 sh -c "npm install && npm run build"

# Regenerate schema.json from the zod schema
docker run --rm -v "$PWD":/app -w /app node:22 sh -c "npm install && npm run gen:schema"
```

## Dev stack (hot-reload)

```mermaid
graph TB
    subgraph "Docker Compose Dev"
        MORPH[Backend API :3101<br/>tsx watch]
        STUDIO[Morph Studio :5173<br/>Vite dev server]
        DEMOS[Demo MCP Servers<br/>:3200 :3201 :3202]
    end
    subgraph "Your Machine"
        BROWSER["Browser → localhost:5173"]
        AGENT["AI Agent → localhost:3101"]
    end
    BROWSER -->|proxies /api, /ws| MORPH
    AGENT --> MORPH
    MORPH --> DEMOS
    STUDIO --> MORPH
```

```bash
# Start all services
docker compose -f docker-compose.dev.yml up -d

# Individual services:
docker compose -f docker-compose.dev.yml up -d morph           # Backend API (hot-reload, port 3101)
docker compose -f docker-compose.dev.yml up -d morph-studio    # Frontend (hot-reload, port 5173)
docker compose -f docker-compose.dev.yml up -d mcp-test-servers # Demo MCPs (ports 3200-3202)

# View logs
docker compose -f docker-compose.dev.yml logs -f morph

# Restart a service (picks up file changes)
docker compose -f docker-compose.dev.yml restart morph

# Full reset (removes volumes)
docker compose -f docker-compose.dev.yml down -v
```

> `node_modules` and `dist` are created as root by the container. To reclaim
> ownership: `docker run --rm -v "$PWD":/app -w /app node:22 chown -R "$(id -u):$(id -g)" /app/node_modules /app/dist`.

## Source layout

```
src/
├── index.ts              CLI + bootstrap + graceful shutdown
├── hub.ts                Hub coordinator (heart of MORPH)
├── metrics.ts            Live aggregate metrics
├── healthcheck.ts        Docker HEALTHCHECK probe
├── config/               Types, zod schema, loader, watcher
├── utils/                Env resolver, retry, version, typed errors
├── logging/              Pino logger (→ stderr), circular log store (LogStore)
├── mcp-client/           Base client + stdio/http/sse + factory + registry
│   ├── oauth-store.ts    OAuth session persistence
│   └── oauth-provider.ts OAuthClientProvider for MCP SDK
├── router/               Tool → backend routing + conflict resolution
├── toon/                 Converter + optimizer + savings stats
├── health/               Periodic backend ping
├── mcp-server/           Agent-facing MCP server + built-in tools
├── import/               Claude/VS Code/Copilot config importers
├── persistence/          SQLite store (logs + call stats)
├── examples/             Demo MCP servers (stdio, http, sse, oauth, params)
└── web/                  Fastify REST API + WebSocket + static Studio

web-frontend/             Morph Studio (Vite + React 19, Tailwind v4, shadcn/ui)
tests/
├── unit/                 16 test files, 124+ tests
│   ├── store.test.ts     SQLite persistence + ID sync
│   ├── log-store.test.ts In-memory log store (custom IDs, field preservation)
│   ├── hub.test.ts       Built-in tool TOON conversion
│   ├── demo-servers.test.ts Demo MCP server startup + tool calls
│   └── ...
├── integration/          Real stdio MCP round-trip + TOON
└── fixtures/             Test MCP server (echo/fail/delay/large_json)
```

## Test coverage

```mermaid
pie title Test Distribution (124 tests)
    "Store + LogStore" : 23
    "MCP Handler" : 10
    "Web Server / Config" : 21
    "TOON Converter + Optimizer" : 20
    "OAuth + Env + Router" : 17
    "MCP Connection" : 6
    "Hub + Demo Servers" : 14
    "Integration" : 5
    "Importer + Health" : 8
```

| File | Tests | Scope |
|------|-------|-------|
| `unit/store.test.ts` | 18 | SQLite CRUD, ID sync, totalizers |
| `unit/log-store.test.ts` | 5 | In-memory store, custom IDs, field preservation |
| `unit/hub.test.ts` | 6 | Built-in tools TOON conversion |
| `unit/demo-servers.test.ts` | 8 | STDIO/HTTP/SSE/OAuth demo server tests |
| `unit/mcp-connection.test.ts` | 6 | MCPClientRegistry lifecycle + tool calls |
| `unit/mcp-handler.test.ts` | 10 | JSON-RPC handler, error codes |
| `unit/web-server.test.ts` | 14 | Schema validation |
| `unit/toon-converter.test.ts` | 4 | TOON encode/decode |
| `unit/optimizer.test.ts` | 16 | Uniform array, max depth, decideConvert |
| `unit/router.test.ts` | 5 | Tool resolution, conflicts |
| `unit/oauth-store.test.ts` | 7 | OAuth CRUD, persistence |
| `unit/config-loader.test.ts` | 7 | Config parsing, validation |
| `unit/env-resolver.test.ts` | 5 | Environment variable resolution |
| `unit/importer.test.ts` | 4 | Config import from Claude/VS Code/Copilot |
| `unit/health-checker.test.ts` | 4 | Start/stop, refresh tools |
| `integration/tool-routing.test.ts` | 5 | Real stdio round-trip + TOON conversion |

## CI Pipeline

```mermaid
flowchart LR
    PUSH[git push] --> TC[TypeScript Typecheck]
    TC --> T[npm test]
    T --> B[npm run build]
    B --> FE[Frontend build]
    FE --> DOCKER[Docker build & push]
```

Two GitHub Actions workflows handle CI/CD automatically:

- **ci.yml** — runs on push/PR to `main`: typecheck → test → build
- **docker.yml** — runs on push to `main` + tags `v*`: build & push Docker image to GHCR

## ESM notes

The project is pure ESM (`"type": "module"`, TS `NodeNext`). Intra-package
imports use explicit `.js` extensions even from `.ts` files — that is how
NodeNext resolves compiled output. The MCP SDK and `@toon-format/toon` are
ESM-only.

## Testing

- Unit tests are pure and fast.
- The integration test spawns the fixture MCP server via the locally-installed
  `tsx` binary (`node_modules/.bin/tsx`), so no build step is required to run
  `npm test`.
- Logger output goes to **stderr** so it never corrupts the stdio MCP protocol
  on stdout — keep it that way.
