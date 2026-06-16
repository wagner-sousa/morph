# Architecture

MORPH is an MCP server that proxies to other MCP servers. The AI agent connects to MORPH over stdio or HTTP; MORPH fans out to backend MCPs over stdio/HTTP/SSE, converts JSON results to TOON, and returns them.

## Layers

```mermaid
graph TB
    subgraph Agent Layer
        Agent[AI Agent]
    end
    subgraph MORPH Core
        direction TB
        MCP[MCP Server] --> Hub[Hub]
        Hub --> Router[Router]
        Hub --> Converter[TOON Converter]
        Hub --> Registry[MCP Client Registry]
        Hub --> Metrics[Metrics]
        Hub --> LS[LogStore]
    end
    subgraph Persistence
        SQL[(SQLite)]
        FS[oauth-sessions.json]
    end
    subgraph Backend MCPs
        S1[MCP STDIO]
        S2[MCP HTTP]
        S3[MCP SSE]
    end
    subgraph Web UI
        API[Fastify API]
        WS[WebSocket]
        Studio[Morph Studio]
    end
    Agent --> MCP
    Hub --> API & WS
    API --> Studio
    LS --> SQL
    Registry --> S1 & S2 & S3
    Registry --> FS
```

| Layer                   | Code                                        | Responsibility                                                                        |
| ----------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------- |
| Agent-facing MCP server | `src/mcp-server/server.ts`                  | Exposes `tools/list` + `tools/call` to the agent                                      |
| Hub                     | `src/hub.ts`                                | Coordinates everything; routes calls, converts, records metrics, persists logs        |
| Router                  | `src/router/`                               | Maps exposed tool name → backend MCP (+ conflict resolution)                          |
| MCP client factory      | `src/mcp-client/factory.ts`                 | Builds a client per transport type                                                    |
| MCP clients             | `src/mcp-client/{stdio,http,sse}-client.ts` | Talk to one backend each (extend `BaseMCPClient`)                                     |
| Registry                | `src/mcp-client/registry.ts`                | Lifecycle: connect/disconnect/hot add/remove, tool cache, OAuth provider creation     |
| OAuth provider          | `src/mcp-client/oauth-provider.ts`          | MCP SDK OAuthClientProvider — PKCE, redirect, token storage                           |
| OAuth store             | `src/mcp-client/oauth-store.ts`             | Persists OAuth sessions (tokens, PKCE verifier, client info) to `oauth-sessions.json` |
| TOON converter          | `src/toon/`                                 | JSON→TOON conversion + optimizer + savings stats                                      |
| Health checker          | `src/health/checker.ts`                     | Periodic ping of backends                                                             |
| Config                  | `src/config/`                               | Load, validate (zod), `${ENV}` resolution, file watch                                 |
| Web API                 | `src/web/server.ts`                         | Fastify REST + WebSocket + static Studio                                              |
| SQLite persistence      | `src/persistence/store.ts`                  | Logs, call stats, token savings, totalizers                                           |
| In-memory log store     | `src/logging/store.ts`                      | Circular buffer for live log stream (IDs synced with SQLite)                          |
| Metrics                 | `src/metrics.ts`                            | Live aggregate stats (calls, tokens, savings by MCP)                                  |

## Startup Flow

```mermaid
sequenceDiagram
    participant CLI as CLI
    participant Hub as Hub
    participant Registry as Registry
    participant Router as Router
    participant MCP as MCP Server
    participant Health as Health Checker
    participant Web as Web API

    CLI->>Hub: new Hub(config)
    Hub->>Hub: create Converter, Router, Registry, OAuthStore, Metrics, Stores
    Hub->>Registry: initialize(mcpServers)
    Registry->>Registry: connect each enabled MCP
    Registry-->>Hub: tools discovered
    Hub->>Router: buildRoutes(tools)
    Router-->>Hub: routes built
    Hub->>MCP: listenStdio() / listenHttp()
    MCP-->>CLI: ready
    Hub->>Health: start()
    Health-->>Hub: periodic pings
    Hub->>Web: start(host, port)
    Web-->>CLI: listening
```

1. Load & validate `morph.json`, resolve `${ENV_VAR}`.
2. `Hub` constructor: create converter, router, registry, OAuth store, metrics, stores.
3. `Registry.initialize()` — connect every enabled MCP, discover tools.
   - HTTP MCPs with OAuth: registry creates a `MorphOAuthProvider` per MCP.
   - If the server returns 401, the SDK transport initiates the OAuth flow.
4. `Router.buildRoutes()` — aggregate tools, resolve name conflicts (auto-prefix or aliases).
5. `MorphMCPServer` connects over stdio (agent transport).
6. Health checker starts; config watcher arms hot-reload.
7. Web API (Fastify) listens on the configured port.

## Tool-Call Flow

```mermaid
sequenceDiagram
    participant Agent as AI Agent
    participant MCP as MCP Server
    participant Hub as Hub
    participant Router as Router
    participant Client as MCP Client
    participant Converter as TOON Converter
    participant SQL as SQLite
    participant Log as LogStore

    Agent->>MCP: tools/call(name, args)
    MCP->>Hub: callTool(name, args)
    Hub->>Hub: isBuiltinTool(name)?
    alt Built-in tool
        Hub->>Hub: callBuiltin(name)
        Hub->>Converter: convertResult(json)
        Converter-->>Hub: TOON result
    else Backend MCP
        Hub->>Router: resolve(name)
        Router-->>Hub: { mcpName, originalName }
        Hub->>Client: callTool(originalName, args)
        Client-->>Hub: JSON result
        Hub->>Hub: save rawOutput
        Hub->>Converter: convertResult(json)
        Converter-->>Hub: TOON result + savings
        Hub->>SQL: appendLog(entry)
        SQL-->>Hub: rowId
        Hub->>Log: append({ id: rowId, ... })
    end
    Hub-->>MCP: CallToolResult (TOON)
    MCP-->>Agent: result
```

## OAuth Flow

When an HTTP MCP returns a 401 challenge, MORPH automatically initiates the OAuth 2.0 Authorization Code flow with PKCE:

```mermaid
sequenceDiagram
    participant Registry as Registry
    participant Client as HTTP Client
    participant Server as MCP Server
    participant OAuthP as OAuth Provider
    participant OAuthS as OAuth Store
    participant User as User Browser

    Registry->>Client: connect()
    Client->>Server: initialize request
    Server-->>Client: 401 Unauthorized
    Client->>OAuthP: redirectToAuthorization(url)
    OAuthP->>OAuthS: save authorizationUrl
    OAuthP-->>Client: pendingUrl stored
    Client->>OAuthP: waitForRedirect()
    OAuthP-->>Client: authorization URL
    Client-->>User: open browser
    User->>Server: GET /authorize?client_id=...
    Server-->>User: redirect to callback
    User->>OAuthP: GET /callback?code=...
    OAuthP->>OAuthS: save tokens
    OAuthP-->>Client: authorization completed
    Client->>Server: initialize with Bearer token
    Server-->>Client: 200 OK (connected)
    Client-->>Registry: connected
```

## Log ID Synchronization

The system uses **two stores** — an in-memory circular buffer (`LogStore` for the live `/api/logs` stream) and SQLite (`Store` for persistence and `/api/logs/:id` detail queries). Their IDs are synchronized by always writing to SQLite first and using the returned `lastInsertRowid` for the LogStore entry. This ensures clicking a log in the list always shows the correct detail.

```mermaid
flowchart LR
    A[Tool call] --> B[Store.appendLog]
    B --> C[(SQLite)]
    C -->|returns rowId| D[LogStore.append]
    D --> E[In-memory buffer]
    E --> F[/api/logs]
    C --> G[/api/logs/:id]
    F & G --> H[Same ID always]
```

## Built-in Tools

Tools prefixed with `_morph_` are handled directly by the Hub (never routed):

| Tool                   | Description                                                |
| ---------------------- | ---------------------------------------------------------- |
| `_morph_status`        | MORPH status: connected MCPs, tools count, uptime, version |
| `_morph_toon_stats`    | Aggregate TOON token-savings statistics                    |
| `_morph_reload_config` | Force reload of `morph.json` from disk                     |

All built-in results pass through the TOON converter for consistent output format.

## Conflict Resolution

When two MCPs expose the same tool name, the Router:

```mermaid
flowchart LR
    A[Tool name conflict] --> B{Aliases defined?}
    B -->|Yes| C[Use alias as exposed name]
    B -->|No| D{allowConflicts?}
    D -->|Yes| E[Last MCP wins]
    D -->|No| F[Auto-prefix: MCP_tool]
```

1. Honors an explicit `aliases` entry from config.
2. Otherwise auto-prefixes both as `${mcp}_${tool}`.
3. If `morph.allowConflicts` is set, the last MCP wins (logged warning).

## Hot-Reload

`ConfigWatcher` (chokidar, 300 ms debounce) emits only _valid_ configs. The Hub diffs old vs new and applies adds/removes/updates to the registry without a full restart, then rebuilds the router and notifies the agent via `notifications/tools/list_changed`.

## Graceful Shutdown

On `SIGTERM`/`SIGINT`: close the agent transport → drain in-flight calls (with `MORPH_SHUTDOWN_TIMEOUT`) → stop health checker & watcher → disconnect backends → close web server & SQLite → exit.
