# Architecture

MORPH is an MCP server that proxies to other MCP servers. The AI agent connects
to MORPH over stdio or HTTP; MORPH fans out to backend MCPs over stdio/HTTP/SSE,
converts JSON results to TOON, and returns them.

## Layers

| Layer | Code | Responsibility |
|-------|------|----------------|
| Agent-facing MCP server | `src/mcp-server/server.ts` | Exposes `tools/list` + `tools/call` to the agent |
| Hub | `src/hub.ts` | Coordinates everything; routes calls, converts, records metrics, persists logs |
| Router | `src/router/` | Maps exposed tool name → backend MCP (+ conflict resolution) |
| MCP client factory | `src/mcp-client/factory.ts` | Builds a client per transport type |
| MCP clients | `src/mcp-client/{stdio,http,sse}-client.ts` | Talk to one backend each (extend `BaseMCPClient`) |
| Registry | `src/mcp-client/registry.ts` | Lifecycle: connect/disconnect/hot add/remove, tool cache, OAuth provider creation |
| OAuth provider | `src/mcp-client/oauth-provider.ts` | MCP SDK OAuthClientProvider — PKCE, redirect, token storage |
| OAuth store | `src/mcp-client/oauth-store.ts` | Persists OAuth sessions (tokens, PKCE verifier, client info) to `oauth-sessions.json` |
| TOON converter | `src/toon/` | JSON→TOON conversion + optimizer + savings stats |
| Health checker | `src/health/checker.ts` | Periodic ping of backends |
| Config | `src/config/` | Load, validate (zod), `${ENV}` resolution, file watch |
| Web API | `src/web/server.ts` | Fastify REST + WebSocket + static Studio |
| SQLite persistence | `src/persistence/store.ts` | Logs, call stats, token savings, totalizers |
| In-memory log store | `src/logging/store.ts` | Circular buffer for live log stream (IDs synced with SQLite) |
| Metrics | `src/metrics.ts` | Live aggregate stats (calls, tokens, savings by MCP) |

## Startup flow

1. Load & validate `morph.json`, resolve `${ENV_VAR}`.
2. `Hub` constructor: create converter, router, registry, OAuth store, metrics, stores.
3. `Registry.initialize()` — connect every enabled MCP, discover tools.
   - HTTP MCPs with OAuth: registry creates a `MorphOAuthProvider` per MCP.
   - If the server returns 401, the SDK transport initiates the OAuth flow.
4. `Router.buildRoutes()` — aggregate tools, resolve name conflicts (auto-prefix or aliases).
5. `MorphMCPServer` connects over stdio (agent transport).
6. Health checker starts; config watcher arms hot-reload.
7. Web API (Fastify) listens on the configured port.

## Tool-call flow

```
agent tools/call(name, args)
  → Hub.callTool
     → Built-in? → callBuiltin() → ToonConverter.convertResult() → return
     → Router.resolve(name) → { mcpName, originalName }
     → client.callTool(originalName, args)                   (backend JSON result)
     → rawOutput = content[0].text                            (original JSON saved)
     → ToonConverter.convertResult()                          (JSON → TOON if beneficial)
     → savings: originalTokens, toonTokens, percent           (calculated)
     → record metrics + store in SQLite (returns row id)     (ID used for both stores)
     → append to in-memory LogStore with SQLite ID            (IDs stay in sync)
  ← CallToolResult (TOON, with savings in _meta)

On router failure (tool not found):
  → Log error to both stores with mcpName='system'
  → Throw error (caught by MCP server handler)
```

## Log ID synchronization

The system uses **two stores** — an in-memory circular buffer (`LogStore` for
the live `/api/logs` stream) and SQLite (`Store` for persistence and
`/api/logs/:id` detail queries). Their IDs are synchronized by always writing
to SQLite first and using the returned `lastInsertRowid` for the LogStore entry.
This ensures clicking a log in the list always shows the correct detail.

## OAuth flow (HTTP MCPs with 401 challenge)

```
MORPH registry → creates MorphOAuthProvider per HTTP MCP
  → client.connect() → SDK sends initialize → server returns 401
  → SDK transport calls authProvider.redirectToAuthorization(url)
     → saves authorization URL to OAuthStore
     → sets pendingUrl (fixes SDK waitForRedirect race condition)
  → SDK transport calls authProvider.waitForRedirect()
     → resolves immediately if pendingUrl exists
  → SDK redirects user to authorization URL
  → User authorizes → redirected to MORPH callback endpoint
  → MORPH exchanges code for token → saves to OAuthStore
  → SDK reconnects with bearer token → connection established
```

## Built-in tools

Tools prefixed with `_morph_` are handled directly by the Hub (never routed):

| Tool | Description |
|------|-------------|
| `_morph_status` | MORPH status: connected MCPs, tools count, uptime, version |
| `_morph_toon_stats` | Aggregate TOON token-savings statistics |
| `_morph_reload_config` | Force reload of `morph.json` from disk |

All built-in results pass through the TOON converter for consistent output format.

## Conflict resolution

When two MCPs expose the same tool name, the Router:
1. honours an explicit `aliases` entry from config;
2. otherwise auto-prefixes both as `${mcp}_${tool}`;
3. if `morph.allowConflicts` is set, the last MCP wins (logged warning).

## Hot-reload

`ConfigWatcher` (chokidar, 300 ms debounce) emits only *valid* configs. The Hub
diffs old vs new and applies adds/removes/updates to the registry without a full
restart, then rebuilds the router and notifies the agent via
`notifications/tools/list_changed`.

## Graceful shutdown

On `SIGTERM`/`SIGINT`: close the agent transport → drain in-flight calls (with
`MORPH_SHUTDOWN_TIMEOUT`) → stop health checker & watcher → disconnect backends
→ close web server & SQLite → exit.
