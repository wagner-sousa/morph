# MORPH — Development Plan & Status

## Current Status (v2.0)

All core features are implemented and tested:

### ✅ Completed

| Area                  | Status | Details                                                      |
| --------------------- | ------ | ------------------------------------------------------------ |
| MCP Client Layer      | ✅     | STDIO, HTTP (Streamable), SSE transports                     |
| OAuth Support         | ✅     | PKCE flow, Dynamic Client Registration, token persistence    |
| Tool Router           | ✅     | Name resolution, conflict auto-prefix, aliases               |
| TOON Converter        | ✅     | JSON→TOON, optimizer (uniform array, depth), savings stats   |
| Config System         | ✅     | Zod schema, `${ENV}` resolution, hot-reload watcher          |
| Web API               | ✅     | Fastify REST + WebSocket, OAuth routes                       |
| SQLite Persistence    | ✅     | Logs, call stats, savings history, totalizers                |
| In-memory Log Store   | ✅     | Circular buffer, ID-synced with SQLite                       |
| Web UI (Morph Studio) | ✅     | Dashboard, MCP CRUD, Logs, Stats, Settings                   |
| Log Detail            | ✅     | JSON vs TOON side-by-side, token savings, split view         |
| MCP Tools Modal       | ✅     | Tool listing with JSON/TOON toggle                           |
| Built-in Tools        | ✅     | `_morph_status`, `_morph_toon_stats`, `_morph_reload_config` |
| Demo MCP Servers      | ✅     | STDIO, HTTP, SSE, HTTP+OAuth, STDIO+params                   |
| Tests                 | ✅     | 124+ tests across 16 files                                   |
| Docker                | ✅     | Multi-stage Dockerfile, dev compose, production compose      |

### Architecture Overview

```mermaid
flowchart TB
    subgraph "AI Agent"
        A[Claude / Copilot / Cursor]
    end
    subgraph "MORPH Gateway"
        direction TB
        MS[MCP Server] --> H[Hub]
        H --> R[Router]
        H --> TC[TOON Converter]
        H --> REG[Registry]
        REG --> SC[STDIO Client]
        REG --> HC[HTTP Client]
        REG --> SSEC[SSE Client]
        REG --> OA[OAuth Provider]
        H --> WEB[Web API]
        H --> M[Metrics]
        H --> LS[LogStore]
        H --> SQL[(SQLite)]
    end
    subgraph "Backend MCPs"
        S1[MCP A]
        S2[MCP B]
        S3[MCP C]
    end
    subgraph "Web UI"
        FE[Morph Studio]
    end
    A -->|MCP stdio/HTTP| MS
    SC -->|stdio| S1
    HC -->|HTTP| S2
    SSEC -->|SSE| S3
    WEB --> FE
```

### Key Design Decisions

1. **Two log stores** — In-memory circular buffer for live streaming (`/api/logs`), SQLite for persistence and detail queries (`/api/logs/:id`). IDs are synchronized by writing to SQLite first and using the returned ID.

2. **OAuth provider race fix** — `MorphOAuthProvider.redirectToAuthorization()` stores the pending URL in a field that `waitForRedirect()` checks before creating a new Promise, preventing the race condition where `redirectToAuthorization` is called before `waitForRedirect`.

3. **Built-in tools bypass router** — Prefixed with `_morph_`, handled directly by Hub. All results pass through the TOON converter for consistent output format.

4. **Demo MCP servers** — Five self-contained servers for testing all transport types and features. The OAuth demo includes full metadata, client registration, authorize/token endpoints, and accepts `demo-token` via `apiKey`.

### Data Flow

```mermaid
sequenceDiagram
    participant Agent
    participant Hub
    participant Router
    participant Client as MCP Client
    participant Converter as TOON Converter
    participant SQL as SQLite
    participant Log as LogStore

    Agent->>Hub: callTool(name, args)
    Hub->>Router: resolve(name)
    Router-->>Hub: { mcpName, originalName }
    Hub->>Client: callTool(originalName, args)
    Client-->>Hub: JSON result
    Hub->>Hub: save rawOutput
    Hub->>Converter: convertResult(raw)
    Converter-->>Hub: TOON result + savings
    Hub->>SQL: appendLog(entry)
    SQL-->>Hub: rowId
    Hub->>Log: append({ id: rowId, ... })
    Hub-->>Agent: CallToolResult (TOON)
```

### Ports

| Service        | Port | Purpose                                           |
| -------------- | ---- | ------------------------------------------------- |
| Backend API    | 3101 | Fastify REST + WebSocket                          |
| Frontend (dev) | 5173 | Vite dev server (proxies /api and /ws to backend) |
| Demo HTTP MCP  | 3200 | Demo MCP via HTTP                                 |
| Demo SSE MCP   | 3201 | Demo MCP via SSE                                  |
| Demo OAuth MCP | 3202 | Demo MCP via HTTP + OAuth                         |

### Test Coverage

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

```
16 test files, 124+ tests:

┌─────────────────────────────────────────────────────┐
│ Unit Tests (118)                                     │
│  ├── store.test.ts          18  SQLite + ID sync     │
│  ├── log-store.test.ts       5  ID + field tests     │
│  ├── hub.test.ts             6  Built-in TOON        │
│  ├── demo-servers.test.ts    8  Demo MCP startup     │
│  ├── mcp-connection.test.ts  6  Registry lifecycle   │
│  ├── mcp-handler.test.ts    10  JSON-RPC handler     │
│  ├── web-server.test.ts     14  Schema validation    │
│  ├── toon-converter.test.ts  4  TOON encode/decode   │
│  ├── optimizer.test.ts      16  Uniform array + more │
│  ├── router.test.ts          5  Tool resolution      │
│  ├── oauth-store.test.ts     7  OAuth CRUD           │
│  ├── config-loader.test.ts   7  Config parsing       │
│  ├── env-resolver.test.ts    5  Environment vars     │
│  ├── importer.test.ts        4  Config import        │
│  └── health-checker.test.ts  4  Health checker       │
├── Integration Tests (6)                               │
│  └── tool-routing.test.ts    5  Real MCP round-trip  │
└─────────────────────────────────────────────────────┘
```

### CI/CD Pipeline

```mermaid
flowchart LR
    PUSH[git push] --> TC[TypeScript Typecheck]
    TC --> T[Test Suite 124+]
    T --> B[Build Backend]
    B --> FE[Build Frontend]
    FE --> D[Docker Build]
    D --> PUSHREG[Push to GHCR]
```

## Future Roadmap

```mermaid
gantt
    title MORPH Roadmap
    dateFormat  YYYY-MM-DD
    axisFormat  %Y Q%q

    section Short-term
    Web UI Auth               :done, 2026-01-01, 2026-03-01
    Batch Tool Calls          :active, 2026-03-01, 2026-06-01
    Log Export (JSON/CSV)     :2026-04-01, 2026-06-01

    section Medium-term
    Multi-user & API Keys     :2026-06-01, 2026-09-01
    Prometheus Metrics        :2026-06-01, 2026-09-01
    TOON Preview in UI        :2026-07-01, 2026-10-01

    section Long-term
    Plugin System             :2026-10-01, 2027-03-01
    Distributed Mode          :2027-01-01, 2027-06-01
    AI-powered TOON           :2027-03-01, 2027-06-01
```

### Short-term

- [ ] Web UI Basic Auth configuration page
- [ ] Batch tool call execution
- [ ] Export logs as JSON/CSV

### Medium-term

- [ ] Multi-user support with API keys
- [ ] Prometheus metrics endpoint
- [ ] TOON conversion preview in Web UI

### Long-term

- [ ] Plugin system for custom converters
- [ ] Distributed mode (multiple MORPH instances)
- [ ] AI-powered TOON optimization suggestions
