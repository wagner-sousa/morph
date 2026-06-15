# Development

MORPH follows **Specification-Driven Development (SDD)**: write the contract
(types/schema) first, then a failing test, then the implementation.

```
types.ts / schema.ts   →   *.test.ts   →   *.ts (impl)
   (spec)                    (test)          (impl)
```

## Everything runs in Docker

No local Node toolchain is needed.

```bash
# Install + test
docker run --rm -v "$PWD":/app -w /app node:22 sh -c "npm install && npm test"

# Typecheck
docker run --rm -v "$PWD":/app -w /app node:22 sh -c "npm install && npm run typecheck"

# Build (emits dist/)
docker run --rm -v "$PWD":/app -w /app node:22 sh -c "npm install && npm run build"

# Regenerate schema.json from the zod schema
docker run --rm -v "$PWD":/app -w /app node:22 sh -c "npm install && npm run gen:schema"

# Dev stack (API :3100 + Studio :5173, both hot-reload)
docker compose -f docker-compose.dev.yml up
```

> `node_modules` and `dist` are created as root by the container. To reclaim
> ownership: `docker run --rm -v "$PWD":/app -w /app node:22 chown -R "$(id -u):$(id -g)" /app/node_modules /app/dist`.

## Source layout

```
src/
├── index.ts            CLI + bootstrap + graceful shutdown
├── hub.ts              Hub coordinator (heart of MORPH)
├── metrics.ts          live aggregate metrics
├── healthcheck.ts      Docker HEALTHCHECK probe
├── config/             types, zod schema, loader, watcher
├── utils/              env resolver, retry, version, typed errors
├── logging/            pino logger (→ stderr), circular log store
├── mcp-client/         base client + stdio/http/sse + factory + registry
├── router/             tool → backend routing + conflict resolution
├── toon/               converter + optimizer + savings stats
├── health/             periodic backend ping
├── mcp-server/         agent-facing MCP server + built-in tools
├── import/             Claude/VS Code/Copilot config importers
├── persistence/        SQLite store (logs + call stats)
└── web/                Fastify REST API + WebSocket + static Studio

web-frontend/           Morph Studio (Vite + React)
tests/
├── unit/               env, config, router, toon, importer
├── integration/        real stdio MCP round-trip + TOON
└── fixtures/           test-mcp-server.ts (echo/fail/delay/large_json)
```

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
