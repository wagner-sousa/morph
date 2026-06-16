# Contract: REST API & WebSocket — Morph Studio

Backend: Fastify on `:3101` (also serves the built SPA from `./public`). In dev, Vite (`:5173`)
proxies `/api` and `/ws`. Request/response shapes are validated by the Fastify route schemas and
zod (`MCPDefinitionSchema`, `validateConfig`) in `src/web`. `/api` and `/ws` require HTTP Basic
auth when `MORPH_WEB_USERNAME` is set. Errors return `{ error, code, details? }` with status
mapped from the error code.

## MCP management

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/mcps` | List all backend MCPs with status summary. |
| GET | `/api/mcps/:name` | Single MCP status summary + its tools (404 if missing). |
| GET | `/api/mcps/:name/tools` | List a single MCP's tools. |
| POST | `/api/mcps/:name/restart` | Disconnect then reconnect the MCP. |
| POST | `/api/mcps` | Create an MCP (zod-validated; 201; 409 if name exists). |
| PUT | `/api/mcps/:name` | Replace an MCP definition (zod-validated; body name must match URL). |
| DELETE | `/api/mcps/:name` | Remove an MCP (204; 404 if missing). |
| POST | `/api/mcp/:name` | Per-MCP direct JSON-RPC handler (proxies to that MCP). |

## OAuth (per MCP)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/mcps/:name/oauth/status` | OAuth state: needed/url/hasToken/authorized. |
| GET | `/api/mcps/:name/oauth/start` | Begin OAuth; returns `authorizationUrl` or `authorized: true`. |
| GET | `/api/mcps/:name/oauth/callback` | OAuth redirect target; finishes auth, reconnects, returns an HTML page that `postMessage`s the result and closes the popup. |

## Logs & calls

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/logs` | Query logs (filters: `mcp`, `level`, `since`, `limit`). |
| GET | `/api/logs/:id` | Single log detail: input JSON, output JSON, TOON text, token counts (404 if missing). |
| GET | `/api/logs/stream` | SSE fallback for live log streaming. |
| GET | `/api/calls/totals` | Call totals, optionally windowed by `since`. |
| GET | `/api/calls/totalizers` | Overall totalizer rollups (Dashboard widget). |

## Stats

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/stats` | Metrics snapshot. |
| GET | `/api/stats/toon` | TOON savings snapshot. |
| GET | `/api/stats/toon/history` | Savings history (default last 24h; `since` query). |

## Config & system

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/version` | Build/version info. |
| GET | `/api/health` | MCP registry status summary. |
| GET | `/api/config` | Current gateway config. |
| PUT | `/api/config` | Validate, apply, and persist full config. |
| POST | `/api/config/reload` | Reload config from disk. |
| POST | `/api/config/import` | Import config (JSON body or multipart file upload). |

## MCP protocol over HTTP (optional, when mcpServer present)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/mcp` | Direct JSON-RPC handler for the aggregated MCP. |
| GET | `/mcp` | SSE stream (keepalive) for the MCP transport. |

## WebSocket

| Path | Purpose |
|------|---------|
| `/ws` | Realtime push. Server broadcasts `{ channel, event, data, timestamp }` on channels: `logs` (`tool_call`), `stats` (`savings_update`), `health` (`connected`/`disconnected`), `config` (`reloaded`). Client may send `{ channel: "ping" }`; server replies `pong`. Malformed frames ignored. |

## SPA fallback

Unknown non-`/api`, non-`/ws` routes serve `index.html` (client-side routing). Unknown `/api`
or `/ws` routes return `404 { error, code: "NOT_FOUND" }`.
