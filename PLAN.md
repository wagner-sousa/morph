# MORPH — MCP Optimized Response Protocol Handler

> **MORPH** transforms JSON responses from MCP servers into compact, token-efficient **TOON** format, reducing LLM token consumption by 30–60% while providing a unified gateway for all your MCP servers.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Core Problem & Solution](#2-core-problem--solution)
3. [Architecture](#3-architecture)
4. [Tech Stack](#4-tech-stack)
5. [Programming Model: SDD](#5-programming-model-sdd)
6. [Directory Structure](#6-directory-structure)
7. [Component Design](#7-component-design)
   - 7.1 [Config Loader](#71-config-loader)
   - 7.2 [MCP Client Factory](#72-mcp-client-factory)
   - 7.3 [Router](#73-router)
   - 7.4 [MCP Server (Agent-facing)](#74-mcp-server-agent-facing)
   - 7.5 [TOON Converter](#75-toon-converter)
   - 7.6 [MCP Client Registry](#76-mcp-client-registry)
   - 7.7 [Config File Watcher](#77-config-file-watcher)
    - 7.8 [Health Checker](#78-health-checker)
    - 7.9 [Graceful Shutdown](#79-graceful-shutdown)
8. [Data Flow](#8-data-flow)
9. [Configuration](#9-configuration)
   - 9.1 [morph.json](#91-morphjson)
   - 9.2 [.env](#92-env)
   - 9.3 [schema.json](#93-schemajson)
   - 9.4 [Agent Configuration](#94-agent-configuration)
   - 9.5 [Import from Existing MCP Configs](#95-import-from-existing-mcp-configs)
10. [Docker Setup](#10-docker-setup)
    - 10.5 [User Configuration via Docker Volume](#105-user-configuration-via-docker-volume)
11. [Web UI (Morph Studio)](#11-web-ui-morph-studio)
12. [API Reference](#12-api-reference)
13. [Development Roadmap](#13-development-roadmap)
14. [Testing Strategy](#14-testing-strategy)
15. [Future Considerations](#15-future-considerations)

---

## 1. Project Overview

**MORPH** is a **Model Context Protocol (MCP) gateway proxy** that sits between AI agents (Claude Desktop, Claude Code, Cursor, etc.) and your MCP servers. It:

- **Unifies** all MCP servers behind a single endpoint — agents connect only to MORPH
- **Routes** tool calls to the correct backend MCP server automatically
- **Converts** JSON responses to **TOON (Token-Oriented Object Notation)** to save 30–60% tokens
- **Manages** multiple transport types: stdio (local processes), HTTP, and SSE (remote servers)
- **Provides** a web UI for configuration, monitoring, and debugging

### Why MORPH?

| Problem | MORPH Solution |
|---------|----------------|
| Each MCP requires configuring a separate entry point in the agent | A single entry point — the agent only configures MORPH |
| JSON responses consume many LLM context tokens | Automatic JSON → TOON conversion |
| MCPs with stdio require process management | MORPH initializes and manages the processes |
| Remote HTTP/SSE MCPs have no standardized discovery | MORPH abstracts the transport, exposes everything as tools |
| No visibility into what each MCP is doing | Web UI with logs, metrics and statistics |

---

## 2. Core Problem & Solution

### The Problem

```
❌ HOJE:

[Claude Desktop]
  ├── config: mcpServers.filesystem  →  node server-filesystem
  ├── config: mcpServers.clickup     →  npx @anthropic/mcp-clickup
  ├── config: mcpServers.brightdata  →  (config HTTP separada)
  └── config: mcpServers.sequential  →  node sequential-thinking

  → 4 entry points no claude_desktop_config.json
  → Cada resposta volta em JSON puro (caro em tokens)
  → Sem visibilidade centralizada
```

### The Solution

```
✅ COM MORPH:

[Claude Desktop]
  └── config: mcpServers.morph  →  node morph (single entry point)
        │
        ├── stdio ──▶  filesystem (server-filesystem)
        ├── stdio ──▶  clickup (@anthropic/mcp-clickup)
        ├── HTTP  ──▶  brightdata
        └── stdio ──▶  sequential-thinking
              │
              └── TOON converter (30–60% menos tokens)

  → 1 entry point
  → Automatic conversion to TOON
  → Web UI with logs, metrics, management
```

---

## 3. Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        AI AGENT                                  │
│          (Claude Desktop / Claude Code / Cursor)                 │
└──────────────────────┬───────────────────────────────────────────┘
                       │  MCP Protocol (stdio transport)
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│                       MORPH (MCP Server)                         │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐   │
│  │tools/list│  │tools/call│  │  Router  │  │TOON Converter │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───────┬───────┘   │
│       └──────────────┴────────────┴─────────────────┘           │
│                           │                                      │
│          ┌────────────────┼────────────────┐                     │
│          ▼                ▼                ▼                     │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐                  │
│   │  MCP     │    │  MCP     │    │  MCP     │                  │
│   │ Client A │    │ Client B │   │ Client C │  ← MCP Clients   │
│   └────┬─────┘    └────┬─────┘    └────┬─────┘                  │
│        │               │               │                         │
│    stdio◀──▶      HTTP◀──▶        SSE◀──▶                       │
└────────┼───────────────┼───────────────┼─────────────────────────┘
         │               │               │
         ▼               ▼               ▼
  ┌────────────┐  ┌────────────┐  ┌────────────┐
  │filesystem  │  │brightdata  │  │clickup     │
  │(stdio)     │  │(HTTP)      │  │(SSE)       │
  └────────────┘  └────────────┘  └────────────┘
```

### Layers

| Layer | Responsibility |
|-------|----------------|
| **Agent-facing MCP Server** | Exposes `tools/list` and `tools/call` to the AI agent |
| **Router** | Maps tool names to backend MCP clients; handles conflicts via namespacing |
| **MCP Client Factory** | Creates MCP clients based on transport type (stdio, HTTP, SSE) |
| **MCP Client Registry** | Lifecycle management: connect, disconnect, reconnect, health |
| **TOON Converter** | Intercepts `CallToolResult` content and converts JSON → TOON |
| **Config Loader** | Reads `morph.json`, resolves `${ENV_VAR}` secrets, validates schema |
| **Health Checker** | Pings each backend MCP periodically; reports status |
| **Web API** | REST API for the Web UI (CRUD MCPs, logs, metrics) |
| **Config File Watcher** | Detects file changes and hot-reloads MCPs without restart |

---

## 4. Tech Stack

### Backend

| Component | Technology | Justification |
|-----------|------------|---------------|
| Runtime | **Node.js 22+** | MCP SDK is TypeScript; runs `npx` without issues |
| Language | **TypeScript 5.x** | Typing, MCP ecosystem |
| MCP SDK | `@modelcontextprotocol/sdk` | Maintained by Anthropic, supports stdio and HTTP |
| TOON Library | `toon-format` | Official TOON library in TypeScript |
| Web API | **Fastify** | Faster than Express, native schema validation |
| Config validation | `zod` | Schema validation of `morph.json` |
| Logging | `pino` | Structured logger, fast, easy to parse |
| Persistence | `better-sqlite3` | Local SQLite for logs, stats, and event history |

### Frontend (Morph Studio)

| Component | Technology | Justification |
|-----------|------------|---------------|
| Framework | **React 19** | Mature ecosystem |
| Build tool | **Vite** | Fast, native HMR |
| CSS framework | **Tailwind CSS v4** | Utility-first, rapid UI development |
| UI primitives | **shadcn/ui** (Radix + Tailwind) | Accessible, customizable components |
| Icons | **lucide-react** | Lightweight, consistent icon set |
| Charts | **recharts** | TOON savings charts (line, bar, pie) |
| Router | **@tanstack/react-router** | Typed, performant SPA routing |
| Data fetching | **@tanstack/react-query** | Server state cache, auto-refetch, mutations |
| Real-time | **Native WebSocket API** (`useWebSocket` hook) | Realtime logs, health status, live stats |
| File upload | **react-dropzone** | Drag-and-drop file upload (config import) |
| Forms | **react-hook-form** + **zod** | Performant forms with schema validation |
| HTTP client | **ofetch** or **ky** | Lightweight fetch wrapper with TypeScript support |

#### Frontend Dependencies (`web-frontend/package.json`)

```json
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@tanstack/react-router": "^1.0.0",
    "@tanstack/react-query": "^5.0.0",
    "recharts": "^2.15.0",
    "lucide-react": "^0.470.0",
    "react-dropzone": "^14.3.0",
    "react-hook-form": "^7.54.0",
    "@hookform/resolvers": "^4.1.0",
    "zod": "^3.24.0",
    "ofetch": "^1.4.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^3.0.0",
    "class-variance-authority": "^0.7.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "tailwindcss": "^4.0.0",
    "vite": "^6.0.0",
    "typescript": "^5.7.0"
  }
}
```

#### Real-time Architecture

The frontend uses **WebSocket** (via Fastify WebSocket plugin, not SSE) for bidirectional real-time communication:

```
WebSocket  ws://localhost:3100/ws
  ├── channel: logs      →  new log entries stream
  ├── channel: health    →  MCP connection status changes
  ├── channel: stats     →  live TOON savings updates
  └── channel: config    →  config hot-reload notifications
```

A custom `useWebSocket` hook manages reconnection, channel subscription, and message dispatching. Fallback to SSE when WebSocket is unavailable.

#### File Upload Flow (Config Import)

```
User drags file onto react-dropzone zone
  → File read as text (JSON)
  → Sent to POST /api/config/import
  → Backend detects format (Claude/VS Code/Copilot)
  → Returns parsed MCP list with preview
  → User selects which to import
  → POST /api/mcps (batch) to add them
```

The import modal also supports pasting raw JSON from clipboard, and downloading a template for manual filling.

### Infrastructure

| Component | Technology | Justification |
|-----------|------------|---------------|
| Container | **Docker** | Portability, dependencies included |
| Orchestration | **docker compose** | Dev e prod com um comando |
| Python (MCP support) | **python3 + pip** | MCPs like `toon-mcp-server` in Python |

---

## 5. Programming Model: SDD

**Specification-Driven Development (SDD)** is MORPH's programming model. Every implementation starts with the **contract specification** (types, schemas, interfaces), followed by tests that validate the contract, and only then the concrete implementation.

### 5.1 SDD Principles

```
┌─────────────────────────────────────────────────────────┐
│                  1. SPEC (Contract)                      │
│   TypeScript types + zod schemas + interfaces           │
│   → Defines WHAT the system does, not HOW               │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                 2. TEST (Validation)                     │
│   Vitest + typed contracts                              │
│   → Tests behavior against the spec                     │
│   → Failure = spec not implemented or wrong spec        │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│               3. IMPL (Implementation)                   │
│   Concrete code that satisfies the tests                │
│   → Only implements what the spec defines               │
│   → No guessing or "future-proofing"                    │
└─────────────────────────────────────────────────────────┘
```

### 5.2 Development Flow

```
SDD Iteration:

  1. SPEC  → Write or update types/schemas in src/**/types.ts or schema.ts
  2. TEST  → Write test in tests/**/*.test.ts that fails (red)
  3. IMPL  → Implement until the test passes (green)
  4. REFACT → Refactor while keeping tests green
```

### 5.3 Where the Spec Lives

| Artifact | Format | Purpose |
|----------|---------|-----------|
| **Config schema** | `zod` in `src/config/schema.ts` | Defines the valid structure of `morph.json` |
| **MCP Client contract** | Interface `MCPClient` | Contract that every transport (stdio/HTTP/SSE) must implement |
| **Router contract** | Interface `Router` | Tool → MCP routing contract |
| **TOON converter contract** | Interface `ToonConverter` | JSON ↔ TOON conversion contract |
| **Hub contract** | Interface `Hub` | Main contract that coordinates all components |
| **API contract** | Fastify schemas (JSON Schema) | Contract for the Web UI REST routes |
| **MCP Server contract** | MCP SDK types | Contract for communication with agents |

### 5.4 Example: SDD Cycle in MORPH

```typescript
// ─── 1. SPEC: src/mcp-client/types.ts ───
export interface MCPClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  listTools(): Promise<MCpTool[]>;
  callTool(name: string, args: unknown): Promise<CallToolResult>;
  getStatus(): ClientStatus;
  on(event: string, handler: Function): void;
}

// ─── 2. TEST: tests/unit/stdio-client.test.ts ───
describe('StdioMCPClient', () => {
  it('should implement MCPClient', () => {
    const client = new StdioMCPClient({ command: 'node', args: ['server.js'] });
    expect(client).to satisfy<MCPClient>();
  });

  it('should connect and list tools', async () => {
    const client = new StdioMCPClient({ command: 'node', args: [fixtureEchoServer] });
    await client.connect();
    const tools = await client.listTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('echo');
    await client.disconnect();
  });
});

// ─── 3. IMPL: src/mcp-client/stdio-client.ts ───
export class StdioMCPClient implements MCPClient {
  async connect(): Promise<void> { /* implements */ }
  async listTools(): Promise<MCpTool[]> { /* implements */ }
  // ...
}
```

### 5.5 SDD Guidelines

| Rule | Explanation |
|-------|------------|
| **Types first** | No `.ts` file may have implementation without first having the types defined |
| **Tests before impl** | Every new feature starts with a failing test |
| **Config is the source of truth** | Hub behavior is determined by `morph.json`, not by hardcoding |
| **No magic strings** | Every relevant string (tool names, errors, events) is a typed constant |
| **Errors are contracts** | Every function documents the errors it can throw via `Result<T, E>` type or documented throws |
| **Config immutability** | Loaded config is immutable at runtime; changes require explicit hot-reload |

### 5.6 SDD File Structure

```
src/
├── config/
│   ├── types.ts        ← SPEC: morph.json types
│   ├── schema.ts       ← SPEC: zod schema (executable validation)
│   ├── loader.ts       ← IMPL: loads and validates
│   └── loader.test.ts  ← TEST
├── mcp-client/
│   ├── types.ts        ← SPEC: MCPClient interface
│   ├── factory.ts      ← IMPL: client factory
│   ├── stdio-client.ts ← IMPL: concrete implementation
│   ├── stdio-client.test.ts ← TEST
│   └── ...
└── ...
```

Each module follows the pattern: `types.ts` (spec) → `*.test.ts` (test) → `*.ts` (impl).

---

## 6. Directory Structure

```
morph/
├── morph.json                    ← Main versionable config
├── .env                          ← Secrets (not versioned)
├── schema.json                   ← JSON Schema para morph.json
├── package.json
├── tsconfig.json
├── Dockerfile
├── docker-compose.yml
├── docker-compose.dev.yml
├── .dockerignore
├── .gitignore
├── README.md
├── LICENSE
│
├── src/
│   ├── index.ts                  ← Entry point: CLI + server bootstrap
│   │
│   ├── config/
│   │   ├── loader.ts             ← Reads morph.json, resolves ENV vars, validates with zod
│   │   ├── schema.ts             ← Zod schema definition
│   │   ├── watcher.ts            ← File watcher (chokidar) for hot-reload
│   │   └── types.ts              ← Config TypeScript types
│   │
│   ├── mcp-server/               ← Agent-facing MCP server
│   │   ├── server.ts             ← Initializes the MCP server that the agent calls
│   │   ├── handlers.ts           ← tools/list, tools/call handlers
│   │   └── transport.ts          ← Transport (stdio for agent)
│   │
│   ├── mcp-client/               ← Backend MCP clients
│   │   ├── registry.ts           ← Manages client lifecycle
│   │   ├── factory.ts            ← Creates client per type (stdio/HTTP/SSE)
│   │   ├── stdio-client.ts       ← MCP client via stdio (child process)
│   │   ├── http-client.ts        ← MCP client via HTTP/SSE
│   │   └── types.ts              ← Client types
│   │
│   ├── router/
│   │   ├── index.ts              ← Main Router: tool → backend
│   │   ├── resolver.ts           ← Resolves name conflicts, applies namespaces
│   │   └── cache.ts              ← Discovered tools cache
│   │
│   ├── toon/
│   │   ├── converter.ts          ← JSON ↔ TOON (wrapper around toon-format library)
│   │   ├── optimizer.ts          ← Decides whether to convert based on content
│   │   └── stats.ts              ← Calculates token savings
│   │
│   ├── health/
│   │   ├── checker.ts            ← Periodic ping to backend MCPs
│   │   └── status.ts             ← Status aggregated (online/offline/degraded)
│   │
│   ├── web/                      ← Web UI API
│   │   ├── server.ts             ← Fastify server setup
│   │   ├── routes/
│   │   │   ├── mcps.ts           ← MCP CRUD
│   │   │   ├── tools.ts          ← Lists discovered tools
│   │   │   ├── logs.ts           ← Call history
│   │   │   ├── stats.ts          ← Metrics and TOON savings
│   │   │   └── health.ts         ← MCP status
│   │   └── middleware/
│   │       ├── auth.ts           ← Web UI authentication
│   │       └── cors.ts           ← CORS for frontend dev
│   │
│   ├── logging/
│   │   ├── logger.ts             ← Pino structured logger
│   │   ├── store.ts              ← In-memory/circular log storage
│   │   └── transport.ts          ← Log transport for Web UI (SSE)
│   │
│   └── utils/
│   ├── env.ts                ← Resolves ${VAR} in strings
│   ├── retry.ts              ← Retry with backoff for connections
│   └── version.ts            ← Generates version info (git hash, package.json)
│
├── web-frontend/                 ← Morph Studio (React + Vite)
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── routes/
│       │   └── index.tsx
│       ├── pages/
│   │   ├── Dashboard.tsx      ← Overview: status, calls/min, savings
│   │   ├── Mcps.tsx           ← MCP server CRUD
│   │   ├── MCPDetail.tsx      ← Details + tools of a specific MCP
│   │   ├── Logs.tsx           ← History with search and filter
│   │   ├── Stats.tsx          ← TOON savings charts
│   │   └── Settings.tsx       ← Hub global config
│       ├── components/
│       │   ├── ui/                ← shadcn/ui components
│   │   ├── MCPCard.tsx        ← Status card of an MCP
│   │   ├── ToolList.tsx       ← Tool list of an MCP
│   │   ├── TOONStats.tsx      ← TOON savings component
│   │   ├── LogStream.tsx      ← Real-time logs (SSE)
│       │   └── Sidebar.tsx
│       ├── api/
│       │   └── client.ts         ← API client (fetch → backend)
│       ├── hooks/
│       │   ├── useMcps.ts
│       │   ├── useLogs.ts
│       │   └── useStats.ts
│       └── lib/
│           └── utils.ts
│
├── tests/
│   ├── unit/
│   │   ├── config-loader.test.ts
│   │   ├── router.test.ts
│   │   ├── toon-converter.test.ts
│   │   └── env-resolver.test.ts
│   ├── integration/
│   │   ├── hub-lifecycle.test.ts    ← Starts MCPs, discovers tools
│   │   └── tool-routing.test.ts     ← Routes calls correctly
│   └── fixtures/
│       ├── morph.test.json
│   └── test-mcp-server.ts       ← Mock MCP for tests
│
└── docs/
    ├── ARCHITECTURE.md
    ├── CONFIGURATION.md
    └── DEVELOPMENT.md
```

---

## 7. Component Design

### 7.1 Config Loader

**File**: `src/config/loader.ts`
**Schema**: `src/config/schema.ts`

```typescript
interface MorphConfig {
  // Global settings
  morph: {
    version: string;           // Schema version for migrations
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };

  // MCP server definitions
  mcpServers: MCPDefinition[];

  // TOON conversion options
  toon: {
    autoConvert: boolean;      // Enable automatic JSON → TOON (default: true)
    delimiter: 'comma' | 'tab' | 'pipe';
    indent: number;            // 0–8 spaces
    flattenDepth: number;      // Max depth for key folding
    threshold: number;         // Minimum char length to trigger conversion
  };

  // Web UI configuration
  webUi: {
    enabled: boolean;
    host: string;
    port: number;
    auth?: {
      username: string;
      passwordHash: string;
    };
  };

  // Health check settings
  health: {
    intervalMs: number;        // Ping interval (default: 30000)
    timeoutMs: number;         // Ping timeout (default: 5000)
    maxRetries: number;
  };
}

interface MCPDefinition {
  name: string;                // Unique identifier
  enabled: boolean;            // Can be toggled without removing
  description?: string;        // Human-readable description
  labels?: Record<string, string>; // Metadata tags
  transport: StdioTransport | HttpTransport | SseTransport;
}

interface StdioTransport {
  type: 'stdio';
  command: string;             // e.g., "npx"
  args: string[];              // e.g., ["-y", "@anthropic/mcp-clickup"]
  env?: Record<string, string>; // Additional env vars
  cwd?: string;                // Working directory
  timeoutMs?: number;          // Spawn timeout
}

interface HttpTransport {
  type: 'http';
  url: string;                 // MCP server HTTP endpoint
  headers?: Record<string, string>;
  apiKey?: string;
}

interface SseTransport {
  type: 'sse';
  url: string;                 // SSE endpoint URL
  headers?: Record<string, string>;
  reconnectIntervalMs?: number;
}
```

**ENV Variable Resolution**:

All string values in the config support `${ENV_VAR_NAME}` interpolation:

```json
{
  "transport": {
    "command": "npx",
    "args": ["-y", "@anthropic/mcp-clickup", "--api-key=${CLICKUP_API_KEY}"]
  }
}
```

The resolver in `src/utils/env.ts` replaces `${VAR}` with values from `process.env`, throwing a clear error if a required var is missing.

**Validation**:

Using `zod`, the config loader validates:

1. Schema structure (required fields, types)
2. Name uniqueness (no duplicate MCP names)
3. Transport-specific fields (e.g., `command` required for stdio, `url` for HTTP/SSE)
4. Port availability range for Web UI

### 7.2 MCP Client Factory

**File**: `src/mcp-client/factory.ts`

A factory function that creates the appropriate MCP client based on transport type.

```typescript
function createMCPClient(
  definition: MCPDefinition,
  options: ClientOptions
): MCPClient
```

**Stdio Client** (`src/mcp-client/stdio-client.ts`):

- Spawns the command as a child process using `child_process.spawn()`
- Connects via `@modelcontextprotocol/sdk`'s `StdioClientTransport`
- Manages process lifecycle: spawn, kill, restart
- Handles stdout/stderr; stderr is logged but not treated as error (many MCPs log there)
- Timeout detection: if the process exits unexpectedly, tries restart with backoff

```typescript
class StdioMCPClient implements MCPClient {
  private process: ChildProcess;
  private transport: StdioClientTransport;
  private client: Client;

  async connect(): Promise<void>;
  async disconnect(): Promise<void>;
  async listTools(): Promise<Tool[]>;
  async callTool(name: string, args: unknown): Promise<CallToolResult>;
  getStatus(): ClientStatus; // connected, connecting, disconnected, error
  on(event: 'error' | 'exit' | 'timeout', handler: Function): void;
}
```

**HTTP Client** (`src/mcp-client/http-client.ts`):

- Connects to MCP servers via HTTP using `@modelcontextprotocol/sdk`'s `HttpClientTransport`
- Simpler lifecycle: connect via HTTP, keep-alive via configurable interval
- Handles authentication headers

```typescript
class HttpMCPClient implements MCPClient {
  private transport: HttpClientTransport;
  private client: Client;

  async connect(): Promise<void>;
  async disconnect(): Promise<void>;
  async listTools(): Promise<Tool[]>;
  async callTool(name: string, args: unknown): Promise<CallToolResult>;
  getStatus(): ClientStatus;
}
```

**SSE Client** (`src/mcp-client/sse-client.ts`):

- Uses `@modelcontextprotocol/sdk`'s `SSEClientTransport`
- Manages reconnection with exponential backoff
- Handles SSE stream reconnection

```typescript
class SseMCPClient implements MCPClient {
  private transport: SSEClientTransport;
  private client: Client;

  async connect(): Promise<void>;
  async disconnect(): Promise<void>;
  async listTools(): Promise<Tool[]>;
  async callTool(name: string, args: unknown): Promise<CallToolResult>;
  getStatus(): ClientStatus;
}
```

### 7.3 Router

**File**: `src/router/index.ts`

The router maps tool names to MCP clients. It's built dynamically from discovery.

```typescript
interface RouteEntry {
  toolName: string;         // The name exposed to the agent (may be namespaced)
  originalName: string;     // Original tool name from backend
  mcpName: string;          // Backend MCP identifier
}

class Router {
  private routes: Map<string, RouteEntry>;

  // Build routes from all MCP clients after discovery
  buildRoutes(clients: Map<string, MCPClient>): void;

  // Resolve a tool call to the correct MCP client
  resolve(toolName: string): { client: MCPClient; originalName: string };

  // Get all tool definitions for tools/list
  getAllTools(): Tool[];

  // Get the route table for debugging/UI
  getRouteTable(): RouteEntry[];
}
```

**Conflict Resolution**:

When two MCPs expose tools with the same name, the router applies **namespacing**:

| Priority | Strategy | Example |
|----------|----------|---------|
| 1 | **Auto-prefix** | `filesystem.read_file` and `clickup.read_file` |
| 2 | **User override** (in config) | `"aliases": { "read_file": "fs_read" }` |
| 3 | **Last wins** (log warning) | Only if config `allowConflicts: true` |

The user can configure aliases in `morph.json`:

```json
{
  "mcpServers": [
    {
      "name": "filesystem",
      "aliases": {
        "read_file": "fs_read",
        "write_file": "fs_write"
      }
    }
  ]
}
```

### 7.4 MCP Server (Agent-facing)

**File**: `src/mcp-server/server.ts`

This is the MCP server that the AI agent connects to. It:

1. Receives `tools/list` → aggregates all tools from the router
2. Receives `tools/call` → routes to the correct backend, converts to TOON

```typescript
class MorphMCPServer {
  private server: Server;

  constructor(private hub: Hub) {}

  async initialize(): Promise<void> {
    this.server = new Server({
      name: 'morph',
      version: pkg.version,
    }, {
      capabilities: { tools: {} }
    });

    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return { tools: this.hub.getRouter().getAllTools() };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      // 1. Route to backend
      const { client, originalName } = this.hub.getRouter().resolve(name);

      // 2. Execute
      const result = await client.callTool(originalName, args);

      // 3. Convert to TOON
      if (this.hub.getConfig().toon.autoConvert) {
        return this.hub.getToonConverter().convertResult(result);
      }

      return result;
    });
  }

  async listen(transport: Transport): Promise<void> {
    await this.server.connect(transport);
  }
}
```

**Transport for Agent**: The hub connects to the agent via `stdio` by default (standard MCP server behavior). When launched from `claude_desktop_config.json`, it uses stdio. In the future, it can also listen via HTTP/SSE for remote agent connections.

### 7.5 TOON Converter

**File**: `src/toon/converter.ts`

Wraps the `toon-format` library to intercept MCP responses.

```typescript
class ToonConverter {
  constructor(private options: ToonOptions) {}

  /**
   * Convert a CallToolResult's JSON text content to TOON.
   * Returns the original result unchanged if conversion is not beneficial.
   */
  async convertResult(result: CallToolResult): Promise<CallToolResult> {
    const convertedContent = await Promise.all(
      result.content.map(async (item) => {
        if (item.type === 'text' && this.isJson(item.text)) {
          const json = JSON.parse(item.text);
          const toon = this.encode(json);
          const savings = this.estimateSavings(item.text, toon);
          return {
            type: 'text',
            text: toon,
            // Metadata for the agent to understand format
            annotations: {
              format: 'toon',
              originalTokens: savings.originalTokens,
              toonTokens: savings.toonTokens,
              savingsPercent: savings.percent,
            },
          };
        }
        return item;
      })
    );
    return { ...result, content: convertedContent };
  }

  encode(data: unknown): string;
  decode(toonString: string): unknown;
  estimateSavings(json: string, toon: string): TokenSavings;
  shouldConvert(data: unknown): boolean;
}

interface TokenSavings {
  originalBytes: number;
  toonBytes: number;
  originalTokens: number;   // Estimated (1 token ≈ 4 chars)
  toonTokens: number;
  percent: number;          // e.g., 42.5
}
```

**Optimization Decision** (`src/toon/optimizer.ts`):

Not all JSON benefits equally from TOON conversion. The optimizer checks:

| Data Profile | TOON Benefit | Action |
|-------------|--------------|--------|
| Uniform array of objects | 30–60% savings | ✅ Convert |
| Deeply nested (≥4 levels) | 0–15% savings | ⚠️ May skip |
| Small (<100 chars) | Minimal | ❌ Skip (overhead > benefit) |
| Non-uniform / mixed | 15–30% savings | ✅ Convert |

The user can set a `threshold` in config (minimum character count to convert).

### 7.6 MCP Client Registry

**File**: `src/mcp-client/registry.ts`

Manages the lifecycle of all backend MCP clients.

```typescript
class MCPClientRegistry {
  private clients: Map<string, MCPClient>;
  private definitions: Map<string, MCPDefinition>;

  // Initialize all enabled MCPs
  async initialize(): Promise<void>;

  // Connect a specific MCP
  async connect(name: string): Promise<void>;

  // Disconnect a specific MCP
  async disconnect(name: string): Promise<void>;

  // Add a new MCP at runtime (hot-add)
  async add(definition: MCPDefinition): Promise<void>;

  // Remove an MCP at runtime (hot-remove)
  async remove(name: string): Promise<void>;

  // Update an existing MCP (hot-reload)
  async update(name: string, definition: MCPDefinition): Promise<void>;

  // Get all clients
  getAll(): Map<string, MCPClient>;

  // Get a specific client
  get(name: string): MCPClient | undefined;

  // Get status summary for all MCPs
  getStatusSummary(): MCPStatusSummary[];

  // Events
  on(event: 'connected' | 'disconnected' | 'error' | 'toolListChanged', handler: Function): void;
}
```

### 7.7 Config File Watcher

**File**: `src/config/watcher.ts`

Uses `chokidar` to watch `morph.json` for changes. When the file changes:

1. Debounce (300ms) to avoid rapid-fire events
2. Load and validate the new config
3. Compute diff with current config
4. Apply changes without full restart:
   - **Added MCP**: create client, connect, discover tools, update router
   - **Removed MCP**: disconnect, remove from router
   - **Updated MCP**: reconnect if transport changed; update router
   - **Config change**: update TOON options, Web UI settings, etc.

```typescript
class ConfigWatcher {
  private watcher: FSWatcher;

  watch(filePath: string): void;
  private async applyDiff(oldConfig: MorphConfig, newConfig: MorphConfig): Promise<void>;
  stop(): void;
}
```

### 7.8 Health Checker

**File**: `src/health/checker.ts`

Periodically checks each backend MCP's liveness:

```typescript
class HealthChecker {
  private intervals: Map<string, NodeJS.Timer>;

  start(): void;
  stop(): void;

  private async check(mcpName: string, client: MCPClient): Promise<void> {
    // Send a lightweight ping (e.g., tools/list which is cached)
    // Measure response time, update status
  }
}

// Status reported to Web UI
interface MCPStatusSummary {
  name: string;
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  latencyMs: number;
  lastPing: Date;
  toolCount: number;
  lastError?: string;
}
```

---

## 8. Data Flow

### 7.1 Startup Flow

```
1. MORPH starts
   │
2. Loads morph.json
   ├── Validates schema with zod
   ├── Resolves ${ENV_VAR} secrets
   └── If invalid → logs detailed error and exit(1)
   │
3. Configures Pino logger
   │
4. Registry.initialize()
   ├── For each MCPDefinition with enabled: true:
   │   ├── Factory creates client based on transport type
   │   ├── Client.connect()
   │   ├── Client.listTools() → discovers tools
   │   └── Adds to registry
   │
5. Router.buildRoutes(registry.getAll())
   ├── Maps toolName → { client, originalName }
   ├── Detects conflicts → applies namespacing
   └── Prepares tool cache
   │
6. TOON converter init with config options
   │
7. MCP Server initializes
   ├── Creates Server with SDK
   ├── Registers tools/list and tools/call handlers
   └── Connects to transport (stdio for agent)
   │
8. Health Checker.start()
   └── Starts periodic ping to backends
   │
9. Web API (Fastify) starts on the configured port
   │
10. Config Watcher.watch()
    └── Monitors morph.json for hot-reload
    │
11. MORPH ready: "listening on stdio" + "web UI at http://localhost:3100"
```

### 7.2 Tool Call Flow (Runtime)

```
Agent                              MORPH                              Backend MCP
 │                                   │                                    │
 │  tools/call("clickup_create_task",│                                    │
 │    { name: "Review", list_id: 456 })                                  │
 │ ─────────────────────────────────▶│                                    │
 │                                   │                                    │
 │                                Router.resolve("clickup_create_task")  │
 │                                   │      → mcp: "clickup"             │
 │                                   │      → originalName: "clickup_create_task"
 │                                   │                                    │
 │                                StdioMCPClient.callTool(               │
│                                  "clickup_create_task",                │
│                                  { name: "Review", list_id: 456 })    │
 │                                   │ ────────────────────────────────▶│
 │                                   │                                    │
 │                                   │  tools/call response (JSON)       │
 │                                   │ ◀────────────────────────────────│
 │                                   │                                    │
 │                                TOON Converter                         │
 │                                   ├── JSON.parse(content.text)        │
 │                                   ├── toon = encode(json)             │
│                                   ├── calculates savings              │
│                                   └── attaches TOON metadata          │
│                                   │                                    │
│  CallToolResult (TOON format)     │                                    │
│ ◀─────────────────────────────────│                                    │
│                                   │                                    │
│  (Agent delivers to LLM with      │                                    │
│   30-60% fewer tokens)           │                                    │
```

### 7.3 Config Hot-Reload Flow

```
File change detected (chokidar)
  │
  1. Debounce 300ms
  │
  2. Load new config
   ├── If invalid → logs error, keeps current config
   └── If valid → proceed
   │
   3. Diff(old, new)
   ├── MCPs added:
   │   ├── Factory.createClient()
   │   ├── connect()
   │   ├── listTools()
   │   ├── Registry.add()
   │   └── Router.rebuild()
   │
   ├── MCPs removed:
   │   ├── Registry.disconnect(name)
   │   ├── Registry.remove(name)
   │   └── Router.rebuild()
   │
   ├── MCPs changed:
   │   ├── If transport or command changed → reconnect
   │   ├── If only labels/aliases → only updates router
   │   └── Router.rebuild()
   │
   └── Global config changed:
       ├── TOON options → updates converter
       ├── Health interval → restarts checker
       └── Web UI → restarts server
  │
  4. Log summary of changes
```

---

## 9. Configuration

### 9.1 `morph.json` (versionado, git)

File: `morph/morph.json`

```json
{
  "$schema": "./schema.json",
  "morph": {
    "version": "1.0",
    "logLevel": "info"
  },
  "mcpServers": [
    {
      "name": "filesystem",
      "enabled": true,
      "description": "Access to local file system",
      "transport": {
        "type": "stdio",
        "command": "npx",
        "args": [
          "-y",
          "@modelcontextprotocol/server-filesystem",
          "/home/user/projects"
        ]
      }
    },
    {
      "name": "clickup",
      "enabled": true,
      "description": "ClickUp task management",
      "labels": {
        "team": "engineering",
        "type": "project-management"
      },
      "transport": {
        "type": "stdio",
        "command": "npx",
        "args": [
          "-y",
          "@anthropic/mcp-clickup",
          "--api-key=${CLICKUP_API_KEY}"
        ]
      }
    },
    {
      "name": "postgres",
      "enabled": false,
      "description": "PostgreSQL database query",
      "transport": {
        "type": "stdio",
        "command": "npx",
        "args": [
          "-y",
          "@anthropic/mcp-postgres",
          "postgresql://${PG_USER}:${PG_PASS}@localhost:5432/mydb"
        ]
      }
    },
    {
      "name": "brightdata",
      "enabled": true,
      "transport": {
        "type": "http",
        "url": "https://api.brightdata.com/mcp",
        "headers": {
          "Authorization": "Bearer ${BRIGHTDATA_API_KEY}"
        }
      }
    },
    {
      "name": "puppeteer",
      "enabled": true,
      "transport": {
        "type": "stdio",
        "command": "npx",
        "args": [
          "-y",
          "@modelcontextprotocol/server-puppeteer"
        ]
      }
    }
  ],
  "toon": {
    "autoConvert": true,
    "delimiter": "comma",
    "indent": 2,
    "flattenDepth": 4,
    "threshold": 100
  },
  "webUi": {
    "enabled": true,
    "host": "0.0.0.0",
    "port": 3100
  },
  "health": {
    "intervalMs": 30000,
    "timeoutMs": 5000,
    "maxRetries": 3
  }
}
```

### 9.2 `.env` (not versioned, .gitignored)

File: `morph/.env`

```bash
# API Keys
CLICKUP_API_KEY=pk_xxxxx
BRIGHTDATA_API_KEY=bd_xxxxx

# Database credentials
PG_USER=admin
PG_PASS=senha_segura

# Web UI auth (optional)
MORPH_WEB_USERNAME=admin
MORPH_WEB_PASSWORD=senha_admin
```

### 9.3 `schema.json` (versionado, git)

JSON Schema for IDE autocompletion and validation. Generated automatically from the zod schema via `json-schema-to-zod` or similar.

### 9.4 Agent Configuration

To use MORPH, the agent (Claude Desktop, Cursor, etc.) configures **only** MORPH:

```json
// claude_desktop_config.json
{
  "mcpServers": {
    "morph": {
      "command": "node",
      "args": ["/caminho/morph/dist/index.js", "--config", "/caminho/morph/morph.json"],
      "env": {
        "CLICKUP_API_KEY": "pk_xxxx",
        "BRIGHTDATA_API_KEY": "bd_xxxx"
      }
    }
  }
}
```

Ou via Docker:

```json
{
  "mcpServers": {
    "morph": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-v", "/caminho/morph:/config",
        "-p", "3100:3100",
        "morph:latest",
        "--config", "/config/morph.json"
      ]
    }
  }
}
```

### 9.5 Import from Existing MCP Configs

MORPH can import MCP configurations from other tools, avoiding rework when migrating.

#### 9.5.1 Supported Formats

| Tool | Typical path | Root key | Transport key |
|-----------|----------------|------------|-------------------|
| **Claude Desktop** | `~/.config/Claude/claude_desktop_config.json` | `mcpServers` | `command` + `args` (always stdio) |
| **VS Code** (workspace) | `.vscode/mcp.json` | `servers` | `type` + `command` + `args` |
| **VS Code** (global) | `~/.config/Code/User/mcp.json` | `servers` | `type` + `command` + `args` |
| **GitHub Copilot CLI** | `~/.copilot/mcp-config.json` | `mcpServers` | `type` + `command` + `args` |
| **VS Code + Copilot** (devcontainer) | `.devcontainer/devcontainer.json` → `.customizations.vscode.mcp.servers` | `servers` (nested) | `type` + `command` + `args` |

#### 9.5.2 Format Mapping

Each format has differences in structure. The importer normalizes automatically:

```typescript
// Claude → MORPH
{
  "mcpServers": {
    "my-server": {
      "command": "npx",
      "args": ["-y", "@mcp/server"]
    }
  }
}
// ↓ Normaliza para:
{
  "name": "my-server",
  "transport": {
    "type": "stdio",
    "command": "npx",
    "args": ["-y", "@mcp/server"]
  }
}

// VS Code → MORPH
{
  "servers": {
    "my-server": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@mcp/server"],
      "env": { "KEY": "${input:secret}" }
    }
  },
  "inputs": [
    { "type": "promptString", "id": "secret", "password": true }
  ]
}
// ↓ Normaliza para:
{
  "name": "my-server",
  "transport": {
    "type": "stdio",
    "command": "npx",
    "args": ["-y", "@mcp/server"],
    "env": { "KEY": "${input:secret}" }
  }
  // inputs become annotations in the log:
  // "⚠️ VS Code inputs detected: secret (password). Configure manually in .env"
}

// GitHub Copilot CLI → MORPH
{
  "mcpServers": {
    "my-server": {
      "type": "local",
      "command": "npx",
      "args": ["@mcp/server"],
      "tools": ["*"]
    }
  }
}
// ↓ Normaliza para:
{
  "name": "my-server",
  "transport": {
    "type": "stdio",    // "local" → "stdio"
    "command": "npx",
    "args": ["@mcp/server"]
  }
  // "tools": ["*"] is ignored (MORPH exposes all)
}
```

#### 9.5.3 Import Modes

**CLI**

```bash
# Import from specific file
morph import --from ~/.config/Claude/claude_desktop_config.json --format claude

# Auto-detect format by extension/key
morph import --from .vscode/mcp.json

# Import from directory (auto scan)
morph import --from ~/.config --scan

# Import and merge with existing config
morph import --from ~/.copilot/mcp-config.json --merge ./morph.json

# Preview without applying (dry-run)
morph import --from claude_desktop_config.json --dry-run
```

**Explicit format vs. auto-detection**

| Flag | Format |
|----------|---------|
| `--format claude` | Claude Desktop |
| `--format vscode` | VS Code mcp.json |
| `--format copilot` | GitHub Copilot CLI |
| `--format copilot-repo` | GitHub Copilot repo-level |
| `--format auto` (default) | Detects by root key (`mcpServers` vs `servers`) |

**Web UI (Morph Studio)**

On the MCPs page, an "Import" button opens a modal with:

1. **File upload**: drag and drop `claude_desktop_config.json`, `mcp.json`, or `mcp-config.json`
2. **Auto-detection**: the backend identifies the format and previews the found MCPs
3. **Selection**: choose which MCPs to import (checkboxes)
4. **Secret mapping**: fields to fill in `${INPUT:...}` variables that have no counterpart
5. **Confirm**: adds to `morph.json` and activates the MCPs

#### 9.5.4 Importer: Handling VS Code `inputs`

VS Code uses `${input:id}` for secrets — the importer:

1. Detects all `${input:*}` in configurations
2. Checks if there's a corresponding definition in the `inputs` array
3. If the input is `password: true`, logs a warning to configure in `.env`
4. If no definition is found, logs a warning and leaves `${input:id}` as is
5. **Never copies literal secret values** — only references

#### 9.5.5 Importer: Handling GitHub Copilot `$COPILOT_MCP_*`

GitHub Copilot uses special variables `$COPILOT_MCP_*` and `${COPILOT_MCP_*}`:

1. Detects all `$COPILOT_MCP_*` in values
2. Suggests mapping to standard environment variables (e.g., `$COPILOT_MCP_API_KEY` → `${MCP_API_KEY}`)
3. Keeps the original name if there's no mapping, with a warning

#### 9.5.6 Custom Mapping File

For bulk migrations or teams, you can define a mapping file:

```json
// morph-import-map.json
{
  "rewrites": {
    "old-server-name": "new-server-name"
  },
  "envMapping": {
    "${input:github-token}": "${GITHUB_TOKEN}",
    "$COPILOT_MCP_API_KEY": "${OPENAI_API_KEY}"
  },
  "defaults": {
    "enabled": true,
    "toon": {
      "autoConvert": true
    }
  }
}
```

Usage:

```bash
morph import --from .vscode/mcp.json --map morph-import-map.json
```

### 7.9 Graceful Shutdown

**File**: `src/index.ts` (signal handlers)

On `SIGTERM` / `SIGINT`, MORPH performs an orderly shutdown:

```
Signal received (SIGTERM / SIGINT)
  │
  1. Stop accepting new requests (close MCP server transport)
  │
  2. Drain in-flight tool calls (wait with timeout)
  │    └── timeout: 10s (configurable via MORPH_SHUTDOWN_TIMEOUT)
  │
  3. Disconnect all backend MCP clients
  │    ├── stdio: send SIGTERM to child processes, wait 3s, SIGKILL
  │    ├── HTTP: close transport connections
  │    └── SSE: close event streams
  │
  4. Close Web API (Fastify)
  │
  5. Close persistence store (SQLite)
  │
  6. Flush logs
  │
  7. process.exit(0)
```

```typescript
// src/index.ts
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, starting graceful shutdown');

  // Stop health checker
  healthChecker.stop();

  // Close agent-facing MCP server
  await mcpServer.close();

  // Drain in-flight calls with timeout
  await Promise.race([
    hub.drainInFlightCalls(),
    new Promise(resolve => setTimeout(resolve, shutdownTimeout)),
  ]);

  // Disconnect backend MCPs
  await registry.disconnectAll();

  // Close API server
  await webServer.close();

  // Close persistence
  await store.close();

  logger.info('Shutdown complete');
  process.exit(0);
});
```

#### 9.5.7 Import Flow (Code)

```
import(
  filePath: string,
  format?: 'claude' | 'vscode' | 'copilot' | 'auto',
  options?: ImportOptions
) → ImportResult
```

```typescript
interface ImportResult {
  detectedFormat: 'claude' | 'vscode' | 'copilot';
  servers: NormalizedMCPDefinition[];
  warnings: ImportWarning[];
  unresolvedSecrets: string[];
  stats: {
    total: number;
    imported: number;
    skipped: number;
    hasConflicts: boolean;
  };
}

interface ImportWarning {
  type: 'input_secret' | 'copilot_var' | 'unknown_format' | 'conflict' | 'skipped';
  message: string;
  serverName?: string;
}
```

---

## 10. Docker Setup

### 10.1 Dockerfile

```dockerfile
# Stage 1: Build frontend (Morph Studio)
FROM node:22-alpine AS frontend-builder
WORKDIR /app
COPY web-frontend/package.json web-frontend/package-lock.json ./
RUN npm ci
COPY web-frontend/ .
RUN npm run build

# Stage 2: Build backend
FROM node:22-alpine AS backend-builder
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci
COPY src/ ./src/
RUN npm run build

# Stage 3: Runtime
FROM node:22-slim

# Install system dependencies for common MCPs
RUN apt-get update && \
    apt-get install -y \
    python3 \
    python3-pip \
    git \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create morph user for security
RUN addgroup -g 1001 -S morph && \
    adduser -S -u 1001 -G morph morph

WORKDIR /app

# Copy built artifacts
COPY --from=backend-builder /app/dist ./dist
COPY --from=backend-builder /app/node_modules ./node_modules
COPY package.json ./

# Copy frontend build
COPY --from=frontend-builder /app/dist ./public

# Expose Web UI port (also used for HTTP agent transport)
EXPOSE 3100

USER morph

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node dist/healthcheck.js

# Transport mode: "stdio" (default, for Claude Desktop) or "http" (for remote agents)
# Override via: docker run -e MORPH_TRANSPORT=http ...
ENTRYPOINT ["node", "dist/index.js", "start", "--transport", "${MORPH_TRANSPORT:-stdio}"]
```

### 10.2 docker-compose.yml (Production)

```yaml
services:
  morph:
    build:
      context: .
      dockerfile: Dockerfile
    image: morph:latest
    ports:
      - "3100:3100"
    volumes:
      # Config (read-only in production)
      - ./morph.json:/app/morph.json:ro
      - ./.env:/app/.env:ro
      # Data directory for MCPs that need write access
      - ./data:/app/data
      # Docker socket for MCPs that need Docker (optional)
      # - /var/run/docker.sock:/var/run/docker.sock:ro
    env_file:
      - ./.env
    environment:
      - NODE_ENV=production
      - MORPH_CONFIG=/app/morph.json
    restart: unless-stopped
    stop_grace_period: 10s
```

### 10.3 docker-compose.dev.yml (Development)

```yaml
services:
  morph:
    build:
      context: .
      dockerfile: Dockerfile
      target: backend-builder  # Backend only, no frontend build
    ports:
      - "3100:3100"
    volumes:
      # Hot reload
      - ./src:/app/src:delegated
      - ./morph.json:/app/morph.json
      - ./.env:/app/.env
      # npm cache for faster reinstalls
      - node_modules:/app/node_modules
    command: >
      sh -c "npm run dev -- --config /app/morph.json"
    environment:
      - NODE_ENV=development
      - MORPH_CONFIG=/app/morph.json
      - CHOKIDAR_USEPOLLING=true  # WSL compatibility

  morph-studio:
    image: node:22-alpine
    working_dir: /app
    ports:
      - "5173:5173"
    volumes:
      - ./web-frontend:/app
      - /app/node_modules  # anonymous volume
    command: >
      sh -c "npm ci && npm run dev -- --host 0.0.0.0 --port 5173"
    environment:
      - VITE_API_URL=http://localhost:3100
    depends_on:
      - morph

volumes:
  node_modules:
```

### 10.4 .dockerignore

```
node_modules/
dist/
.git/
*.md
.env
data/
web-frontend/node_modules/
web-frontend/dist/
```

### 10.5 User Configuration via Docker Volume

The user provides their MCP configuration by mounting a volume with the `morph.json` file. The transport type for the agent connection (stdio/HTTP) is specified via environment variable.

#### docker-compose.yml (User Setup)

```yaml
services:
  morph:
    image: morph:latest
    ports:
      - "3100:3100"
    volumes:
      # Mount your config directory — just needs morph.json and .env
      - ./my-mcp-config:/config:ro
    environment:
      - MORPH_CONFIG=/config/morph.json
      # Agent-facing transport: "stdio" (default, for Claude Desktop)
      # or "http" (for remote agents)
      - MORPH_TRANSPORT=stdio
      # When using http transport, agents connect to ws://host:3100/mcp
      - MORPH_TRANSPORT_PORT=3100
    env_file:
      - ./my-mcp-config/.env
```

#### User Directory Structure

```
my-mcp-config/                  ← versioned in your project repo
├── morph.json                  ← MCP server definitions + TOON settings
└── .env                        ← API keys (gitignored)
```

#### Minimal morph.json Example

```json
{
  "mcpServers": [
    {
      "name": "filesystem",
      "enabled": true,
      "transport": {
        "type": "stdio",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "/data"]
      }
    }
  ],
  "toon": {
    "autoConvert": true
  },
  "webUi": {
    "enabled": true,
    "port": 3100
  }
}
```

#### Docker Run (Single Command)

```bash
# With stdio transport (default, agent connects via spawned process)
docker run -i --rm \
  -v ./my-mcp-config:/config:ro \
  -e MORPH_CONFIG=/config/morph.json \
  -e MORPH_TRANSPORT=stdio \
  -p 3100:3100 \
  morph:latest

# With HTTP transport (agent connects via WebSocket at ws://host:3100/mcp)
docker run -i --rm \
  -v ./my-mcp-config:/config:ro \
  -e MORPH_CONFIG=/config/morph.json \
  -e MORPH_TRANSPORT=http \
  -p 3100:3100 \
  morph:latest
```

The `--rm -i` flags allow MORPH to receive stdin/stdout when used with stdio transport from Claude Desktop. The `MORPH_TRANSPORT` env var is passed to `morph start --transport` automatically by the Dockerfile ENTRYPOINT.

### 10.6 Development Commands

```bash
# Development
docker compose -f docker-compose.dev.yml up
# → MORPH core at http://localhost:3100 (API)
# → MORPH via stdio (for Claude Desktop to connect)
# → Morph Studio at http://localhost:5173

# Production build
docker compose build

# Production
docker compose up -d

# Logs
docker compose logs -f morph

# Executar testes
docker compose -f docker-compose.dev.yml run --rm morph npm test

# Add MCP that needs Python
docker compose exec morph pip install toon-mcp-server
```

---

## 11. Web UI (Morph Studio)

### 11.1 Pages / Routes

| Route | Page | Description |
|-------|------|-------------|
| `/` | **Dashboard** | General status: online/offline MCPs, recent calls, total TOON savings |
| `/mcps` | **MCPs** | List of MCP servers with status, toggle, actions |
| `/mcps/:name` | **MCP Detail** | MCP details, exposed tools, filtered logs, statistics |
| `/mcps/:name/edit` | **MCP Edit** | Edit MCP configuration (modal or page) |
| `/mcps/new` | **MCP New** | Add new MCP (form with template) |
| `/logs` | **Logs** | History with search, filter by MCP, severity, timestamp |
| `/stats` | **TOON Stats** | Token savings charts (last hour, day, week) |
| `/settings` | **Settings** | Hub global config (TOON options, health, export/import config) |

### 11.2 Dashboard Wireframe

```
┌──────────────────────────────────────────────────────────┐
│ MORPH ◆ Studio                             [admin] ⚙️   │
├──────────────────────────────────────────────────────────┤
│ 📊 Dashboard                                             │
│                                                          │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│ │ MCPs      │ │ Tools    │ │ Calls    │ │ Tokens       │ │
│ │  5 online │ │  23      │ │ 142 today│ │ Saved        │ │
│ │  1 offline│ │          │ │          │ │  18.4K 🎯    │ │
│ └──────────┘ └──────────┘ └──────────┘ └──────────────┘ │
│                                                          │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ MCP Status                              │Add MCP ➕│ │
│ ├──────────────────────────────────────────────────────┤ │
│ │ 🟢 filesystem      │ 12 tools │ 2ms │ 📊 │ ⚙️ │ 🔌 │ │
│ │ 🟢 clickup         │  8 tools │ 45ms│ 📊 │ ⚙️ │ 🔌 │ │
│ │ 🟢 puppeteer       │  4 tools │ 15ms│ 📊 │ ⚙️ │ 🔌 │ │
│ │ 🟡 brightdata      │  6 tools │ —   │ 📊 │ ⚙️ │ 🔌 │ │
│ │ 🔴 postgres        │  0 tools │ —   │ 📊 │ ⚙️ │ 🔌 │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Recent Calls                                         │ │
│ ├──────────────────────────────────────────────────────┤ │
│ │ 10:23:45 │ clickup_create_task  │ ✅ │ 12s │ 64% sv│ │
│ │ 10:23:40 │ read_file            │ ✅ │ 0.3s│ 42% sv│ │
│ │ 10:23:30 │ clickup_list_tasks   │ ✅ │ 2.1s│ 58% sv│ │
│ └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### 11.3 API Endpoints

The Web UI communicates with the MORPH backend via REST API:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/mcps` | List all MCP servers with status |
| `GET` | `/api/mcps/:name` | Get MCP details |
| `POST` | `/api/mcps` | Add new MCP |
| `PUT` | `/api/mcps/:name` | Update MCP config |
| `DELETE` | `/api/mcps/:name` | Remove MCP |
| `POST` | `/api/mcps/:name/restart` | Restart MCP connection |
| `POST` | `/api/mcps/:name/toggle` | Enable/disable MCP |
| `GET` | `/api/mcps/:name/tools` | List tools for MCP |
| `GET` | `/api/logs` | Get logs (query params: mcp, level, since, limit) |
| `GET` | `/api/config/import` | Import config (POST with file upload, returns preview) |
| `POST` | `/api/config/import` | Upload config file (multipart), returns parsed MCPs |
| `POST` | `/api/config/import/apply` | Confirm import and apply selected MCPs |
| `GET` | `/api/logs/stream` | SSE stream for real-time logs |
| `WS` | `/ws` | WebSocket for real-time logs, health, stats |
| `GET` | `/api/stats` | Get aggregated statistics |
| `GET` | `/api/stats/toon` | TOON-specific savings data |
| `GET` | `/api/stats/toon/history` | Time-series TOON savings |
| `GET` | `/api/config` | Get current config |
| `PUT` | `/api/config` | Update config (replaces morph.json) |
| `GET` | `/api/health` | Health status of all MCPs |
| `GET` | `/api/version` | MORPH version info |

### 11.4 Real-time Updates

The Web UI uses **WebSocket** (primary) and **SSE** (fallback) for real-time updates:

**WebSocket endpoint**: `ws://localhost:3100/ws`

Protocol: JSON messages with a `channel` field for routing.

```typescript
// Server → Client message
{
  channel: 'logs' | 'health' | 'stats' | 'config';
  event: string;     // e.g., "tool_call", "mcp_status_change", "savings_update"
  data: unknown;     // payload specific to the event
  timestamp: string; // ISO 8601
}

// Client → Server message
{
  channel: 'ping';
  data: { ts: string };
}
```

| Channel | Direction | Events |
|---------|-----------|--------|
| `logs` | Server → Client | `tool_call`, `tool_result`, `error` |
| `health` | Server → Client | `connected`, `disconnected`, `reconnecting` |
| `stats` | Server → Client | `savings_update`, `call_volume` |
| `config` | Server → Client | `reloaded`, `error` |
| `ping` | Client → Server | keep-alive heartbeat |

**SSE fallback** (when WebSocket is unavailable):

- `/api/logs/stream` — New log entries as they happen
- `/api/health/stream` — Status changes (MCP connected/disconnected)
- `/api/stats/stream` — Live token savings updates

### 11.5 API Error Format

All REST API errors follow a minimal JSON structure:

```typescript
interface ApiError {
  error: string;       // Human-readable description
  code: string;        // Machine-readable error code, e.g. "MCP_NOT_FOUND", "INVALID_CONFIG"
  details?: unknown;   // Optional additional context
}
```

HTTP status codes map to error types:
- `400` — `INVALID_INPUT`, `VALIDATION_ERROR`
- `404` — `MCP_NOT_FOUND`, `TOOL_NOT_FOUND`
- `409` — `CONFLICT`, `ALREADY_EXISTS`
- `422` — `VALIDATION_ERROR`
- `500` — `INTERNAL_ERROR`

### 11.6 CORS Configuration

Configured via `@fastify/cors` based on environment:

```typescript
// Development: allow Vite dev server
origin: process.env.NODE_ENV === 'production'
  ? process.env.CORS_ORIGIN || false     // restrict in prod
  : ['http://localhost:5173', 'http://127.0.0.1:5173']  // dev
```

The `CORS_ORIGIN` env var can override the allowed origin in production (e.g., a reverse proxy domain).

### 11.7 Authentication (Web UI)

Optional **HTTP Basic Auth** for the Web UI and API. Configured in `.env`:

```bash
MORPH_WEB_USERNAME=admin
MORPH_WEB_PASSWORD=<bcrypt hash or plain text>
```

The Fastify server registers a preHandler hook on all `/api/*` and `/ws` routes:

```
Request → Basic Auth header present?
  ├── Yes → verify against MORPH_WEB_USERNAME / MORPH_WEB_PASSWORD
  │         ├── Match → proceed
  │         └── No match → 401 Unauthorized
  ├── No → check if auth is configured
  │         ├── Configured → 401 Unauthorized
  │         └── Not configured → proceed (no auth)
```

If `MORPH_WEB_USERNAME` is not set, authentication is disabled (default for local use).

### 11.8 Persistence (SQLite + JSON)

Logs, call history, and TOON savings stats are persisted to **SQLite** via `better-sqlite3`, with a **JSON dump** option for backup/export.

```typescript
// src/persistence/store.ts
class Store {
  private db: Database;

  // Logs table
  async appendLog(entry: LogEntry): Promise<void>;
  queryLogs(filters: LogFilter): Promise<LogEntry[]>;

  // Stats table
  recordCall(mcpName: string, toolName: string, durationMs: number, tokensSaved: number): void;
  getAggregatedStats(since: Date): Promise<AggregatedStats>;

  // Export / backup
  exportToJSON(): Promise<string>;
  importFromJSON(json: string): Promise<void>;
}
```

Schema:

```sql
CREATE TABLE logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mcp_name TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  duration_ms INTEGER,
  tokens_saved INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mcp_name TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  calls INTEGER DEFAULT 0,
  total_duration_ms INTEGER DEFAULT 0,
  total_tokens_saved INTEGER DEFAULT 0,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL
);
```

The database file is stored at `data/morph.db` (configurable via `MORPH_DATA_DIR` env var).

---

## 12. API Reference

### 12.1 CLI

```
Usage: morph <command> [options]

Commands:
  start                     Start MORPH hub (default)
  import                    Import MCP configs from other tools

Options (start):
  --config, -c <path>       Path to morph.json (default: ./morph.json)
  --port, -p <port>         Web UI port (overrides config)
  --transport <type>        Agent-facing transport: stdio | http (default: stdio)
  --log-level <level>       Log level: debug | info | warn | error
  --validate                Validate config and exit
  --version                 Show version
  --help                    Show help

Options (import):
  --from <path>             File to import (required)
  --format <format>         Config format: claude | vscode | copilot | auto (default)
  --merge <path>            Merge into existing morph.json
  --map <path>              Custom mapping file for names/env vars
  --dry-run                 Preview without applying
  --scan                    Scan directory for config files

Examples:
  morph --config ./morph/morph.json
  morph --validate
  morph import --from ~/.config/Claude/claude_desktop_config.json
  morph import --from .vscode/mcp.json --merge ./morph.json --dry-run
  morph import --from ~/.config --scan
```

### 12.2 Programmatic API (for extensibility)

```typescript
import { Morph } from 'morph';

const hub = new Morph({
  configPath: './morph.json',
});

await hub.start();

// Events
hub.on('mcp:connected', (name) => console.log(`${name} connected`));
hub.on('mcp:disconnected', (name) => console.log(`${name} disconnected`));
hub.on('mcp:error', (name, error) => console.error(`${name}: ${error}`));
hub.on('tool:called', (toolName, mcpName, duration) => {
  console.log(`${toolName} on ${mcpName} took ${duration}ms`);
});

await hub.stop();
```

### 12.3 MCP Tools (exposed to agent)

MORPH exposes all tools from all backend MCPs, plus built-in tools:

| Tool Name | Description |
|-----------|-------------|
| `*` (all backend tools) | Routed to respective MCP |
| `_morph_status` | Get MORPH status: connected MCPs, tools count, uptime |
| `_morph_toon_stats` | Get TOON savings statistics |
| `_morph_reload_config` | Force reload of morph.json |

Built-in tools use `_morph_` prefix to avoid conflicts with backend tools.

---

## 13. Development Roadmap

### Phase 1: Foundation (Week 1-2)

- [x] Project scaffolding (package.json, tsconfig, lint)
- [ ] Config loader with ENV var resolution
- [ ] Config schema validation (zod)
- [ ] Logger setup (pino)
- [ ] Basic CLI parser
- [ ] Dockerfile + docker-compose (dev)
- [ ] Unit tests for config loader

### Phase 2: MCP Client Layer (Week 2-3)

- [ ] Stdio MCP client (spawn, connect, listTools, callTool)
- [ ] HTTP MCP client
- [ ] SSE MCP client
- [ ] MCP Client Factory
- [ ] MCP Client Registry (lifecycle management)
- [ ] Error handling + retry logic
- [ ] Integration tests with real MCPs

### Phase 3: Hub Core (Week 3-4)

- [ ] Router with conflict resolution
- [ ] MCP Server (agent-facing) with tools/list + tools/call
- [ ] Route aggregation from multiple backends
- [ ] End-to-end flow: agent → hub → backend → hub → agent
- [ ] Namespace configuration (overrides)
- [ ] Built-in tools (_morph_status, etc.)

### Phase 4: TOON Integration (Week 4-5)

- [ ] TOON converter (encode/decode)
- [ ] TOON optimizer (decide when to convert)
- [ ] Token savings calculator
- [ ] Integration in response pipeline
- [ ] Metadata annotations on converted responses
- [ ] Tests with real TOON format

### Phase 5: Monitoring & Reliability (Week 5-6)

- [ ] Health checker (periodic ping)
- [ ] Config file watcher (hot-reload)
- [ ] Startup/shutdown lifecycle management
- [ ] Graceful MCP disconnection
- [ ] Log store (circular buffer)
- [ ] SSE log streaming

### Phase 6: Web UI API (Week 6-7)

- [ ] Fastify server setup
- [ ] MCP CRUD endpoints
- [ ] Log query endpoints
- [ ] Stats/TOON metrics endpoints
- [ ] Health status endpoints
- [ ] SSE endpoints for real-time updates
- [ ] Auth middleware (basic auth)

### Phase 7: Frontend — Morph Studio (Week 7-9)

- [ ] Vite + React setup with shadcn/ui
- [ ] Dashboard page
- [ ] MCP list + detail pages
- [ ] MCP add/edit forms
- [ ] Logs page with search + filter
- [ ] TOON Stats page with charts
- [ ] Settings page
- [ ] SSE integration for live updates

### Phase 8: Polish & Docs (Week 9-10)

- [ ] Production Dockerfile (multi-stage)
- [ ] docker-compose production
- [ ] README with quickstart
- [ ] ARCHITECTURE.md
- [ ] CONFIGURATION.md
- [ ] DEVELOPMENT.md
- [ ] Example configs
- [ ] Test coverage pass (≥80%)

---

## 14. Testing Strategy

### Unit Tests

| Module | What to test |
|--------|-------------|
| `config/loader` | Valid/invalid configs, ENV var resolution, defaults |
| `config/schema` | Schema validation edge cases, error messages |
| `router` | Conflict detection, namespacing, alias resolution |
| `toon/converter` | JSON→TOON, TOON→JSON, savings calculation |
| `toon/optimizer` | Decision logic (when to skip conversion) |
| `mcp-client/factory` | Correct client type creation by transport |
| `utils/env` | VAR resolution, missing vars, nested vars |

### Integration Tests

| Scenario | What to test |
|----------|-------------|
| **Full lifecycle** | Start hub → discover tools → call tool → verify response |
| **Multi-MCP routing** | 2+ MCPs, tools correctly routed |
| **Conflict resolution** | Same tool names → namespaced correctly |
| **TOON conversion** | Response converted to TOON, metadata present |
| **Hot-reload** | Add/remove/edit MCP via config change |
| **Reconnection** | MCP process dies → auto restart |
| **Error forwarding** | Backend error → forwarded to agent correctly |

### E2E Tests

| Scenario | What to test |
|----------|-------------|
| **Claude Desktop compatibility** | Start hub → Claude connects → calls tool → gets TOON |
| **Web UI flow** | Add MCP via UI → appears in dashboard → edit → save |
| **Docker deployment** | Build → run → configure → use |

### Test Fixtures

- `tests/fixtures/morph.test.json` — Complete test config with mock MCPs
- `tests/fixtures/test-mcp-server.ts` — A minimal MCP server for testing:
  - Exposes `echo` tool (returns args as result)
  - Exposes `fail` tool (returns error)
  - Exposes `delay` tool (configurable latency)
  - Exposes `large_json` tool (returns large nested JSON)

---

## 15. Future Considerations

### Short-term (post-v1)

- **MCP Schema registry**: suggestion engine that recommends MCP servers based on agent needs
- **Response caching**: cache frequent tool responses to reduce latency and token usage
- **Rate limiting**: per-MCP rate limiting to avoid API cost spikes
- **Staged TOON conversion**: convert only large responses, leave small ones as JSON
- **Config export/import**: share MCP configurations via JSON file or URL

### Medium-term

- **Plugin system**: third-party plugins for pre/post-processing of tool calls
- **MCP marketplace**: browse and add MCPs from a registry inside Morph Studio
- **Multi-user**: team workspace with shared MCPs and permissions
- **Prompt templates**: inject TOON-optimized system prompts automatically
- **Agent-specific routing**: different MCP sets per connected agent

### Long-term

- **MCP → OpenAPI bridge**: expose MCP tools as REST API automatically
- **LLM-native format negotiation**: agent asks for format, MORPH adapts (TOON, JSON, CSV, Markdown)
- **Federated MORPH**: multi-instance with shared discovery across teams
- **Edge deployment**: lightweight MORPH for edge/lambda environments
- **TOON v2+ support**: as the TOON spec evolves, MORPH stays compatible

---

## Appendix A: Key Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.10.0",
    "toon-format": "^0.4.0",
    "fastify": "^5.x",
    "@fastify/cors": "^11.x",
    "@fastify/multipart": "^9.x",
    "@fastify/static": "^8.x",
    "@fastify/websocket": "^11.x",
    "better-sqlite3": "^11.x",
    "zod": "^3.x",
    "chokidar": "^4.x",
    "pino": "^9.x",
    "pino-pretty": "^13.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "tsx": "^4.x",
    "vitest": "^3.x",
    "eslint": "^9.x"
  }
}
```

## Appendix B: Ports

| Port | Service |
|------|---------|
| 3100 | MORPH API + Web UI (Fastify) |
| 5173 | Vite dev server (frontend) |
| Stdio | Agent-facing MCP connection |

---

*MORPH: Because your tokens shouldn't be wasted on brackets and quotes.*
