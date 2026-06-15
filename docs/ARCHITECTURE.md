# Architecture

MORPH is an MCP server that proxies to other MCP servers. The AI agent connects
to MORPH over stdio; MORPH fans out to backend MCPs over stdio/HTTP/SSE,
converts JSON results to TOON, and returns them.

## Layers

| Layer | Code | Responsibility |
|-------|------|----------------|
| Agent-facing MCP server | `src/mcp-server/server.ts` | Exposes `tools/list` + `tools/call` to the agent |
| Hub | `src/hub.ts` | Coordinates everything; routes calls, converts, records metrics |
| Router | `src/router/` | Maps exposed tool name → backend MCP (+ conflict resolution) |
| MCP client factory | `src/mcp-client/factory.ts` | Builds a client per transport type |
| MCP clients | `src/mcp-client/{stdio,http,sse}-client.ts` | Talk to one backend each (extend `BaseMCPClient`) |
| Registry | `src/mcp-client/registry.ts` | Lifecycle: connect/disconnect/hot add/remove, tool cache |
| TOON converter | `src/toon/` | JSON→TOON conversion + optimizer + savings stats |
| Health checker | `src/health/checker.ts` | Periodic ping of backends |
| Config | `src/config/` | Load, validate (zod), `${ENV}` resolution, file watch |
| Web API | `src/web/server.ts` | Fastify REST + WebSocket + static Studio |
| Persistence | `src/persistence/store.ts` | SQLite logs + call stats |
| Metrics / logs | `src/metrics.ts`, `src/logging/` | Live aggregates + circular log buffer |

## Startup flow

1. Load & validate `morph.json`, resolve `${ENV_VAR}`.
2. `Registry.initialize()` — connect every enabled MCP, discover tools.
3. `Router.buildRoutes()` — aggregate tools, resolve name conflicts.
4. `Hub` wires converter, health checker, metrics, stores.
5. `MorphMCPServer` connects over stdio (agent transport).
6. Health checker starts; config watcher arms hot-reload.
7. Web API (Fastify) listens on the configured port.

## Tool-call flow

```
agent tools/call(name, args)
  → Hub.callTool
     → Router.resolve(name) → { mcpName, originalName }
     → registry client.callTool(originalName, args)   (backend JSON result)
     → ToonConverter.convertResult()                  (JSON → TOON if beneficial)
     → record metrics + log + persist
  ← CallToolResult (TOON, with savings in _meta)
```

Built-in `_morph_*` tools are handled directly by the Hub, never routed.

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
