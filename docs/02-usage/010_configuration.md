# Configuration

`morph.json` is the single source of truth, validated against `schema.json` (generated from the zod schema via `npm run gen:schema`). All string values support `${ENV_VAR}` interpolation, resolved from the environment / `.env`.

## Schema Overview

```mermaid
mindmap
  root((morph.json))
    morph
      version
      logLevel
      allowConflicts
      toolPrefix
    mcpServers[]
      name
      enabled
      description
      labels
      aliases
      transport
        STDIO
          command
          args
          env
          cwd
          timeoutMs
        HTTP
          url
          headers
          apiKey
        SSE
          url
          headers
          reconnectIntervalMs
    toon
      autoConvert
      delimiter
      indent
      flattenDepth
      threshold
    webUi
      enabled
      host
      port
      publicUrl
      auth
    health
      intervalMs
      timeoutMs
      maxRetries
```

## Top-Level

| Field                  | Type                       | Default   | Notes                                                             |
| ---------------------- | -------------------------- | --------- | ----------------------------------------------------------------- |
| `morph.version`        | string                     | `"1.0"`   | Schema version                                                    |
| `morph.logLevel`       | `debug\|info\|warn\|error` | `info`    |                                                                   |
| `morph.allowConflicts` | boolean                    | `false`   | Last MCP wins on tool-name conflict                               |
| `morph.toolPrefix`     | string                     | —         | Prefix pattern for all exposed tools, e.g. `{name}_` or `{name}:` |
| `mcpServers`           | `MCPDefinition[]`          | `[]`      | Backend MCP servers                                               |
| `toon`                 | object                     | see below | TOON conversion options                                           |
| `webUi`                | object                     | see below | Web UI / API                                                      |
| `health`               | object                     | see below | Health-check cadence                                              |

## `mcpServers[]`

| Field         | Type                    | Required | Notes                                    |
| ------------- | ----------------------- | -------- | ---------------------------------------- |
| `name`        | string                  | ✅       | Unique; `[A-Za-z0-9_.-]`                 |
| `enabled`     | boolean                 | —        | Toggle without removing (default `true`) |
| `description` | string                  | —        | Human-readable label                     |
| `labels`      | `Record<string,string>` | —        | Metadata tags (team, type, env)          |
| `aliases`     | `Record<string,string>` | —        | `originalName → exposedName` overrides   |
| `transport`   | object                  | ✅       | One of the three types below             |

### Transport: STDIO (local process)

```mermaid
flowchart LR
    M[MORPH] -->|spawn node CLI| P[Child Process]
    P -->|stdin JSON-RPC| M
    M -->|stdout JSON-RPC| P
```

```json
{
  "name": "filesystem",
  "enabled": true,
  "description": "Local file system access",
  "labels": { "team": "engineering", "type": "utility" },
  "aliases": { "read_file": "fs_read" },
  "transport": {
    "type": "stdio",
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem", "/data"],
    "env": { "NODE_OPTIONS": "--max-old-space-size=512" },
    "cwd": "/opt/mcp",
    "timeoutMs": 30000
  }
}
```

| Field       | Type                    | Required | Notes                                        |
| ----------- | ----------------------- | -------- | -------------------------------------------- |
| `type`      | `"stdio"`               | ✅       |                                              |
| `command`   | string                  | ✅       | Executable path or name                      |
| `args`      | string[]                | —        | Command arguments (default `[]`)             |
| `env`       | `Record<string,string>` | —        | Environment variables, supports `${ENV_VAR}` |
| `cwd`       | string                  | —        | Working directory                            |
| `timeoutMs` | number                  | —        | Process timeout in milliseconds              |

### Transport: HTTP (Streamable HTTP)

```mermaid
flowchart LR
    M[MORPH] -->|POST JSON-RPC| S[MCP Server]
    S -->|JSON-RPC response| M
    alt OAuth
        S -->|401 challenge| M
        M -->|OAuth flow| S
    end
```

```json
{
  "name": "stripe",
  "enabled": true,
  "description": "Stripe API via MCP",
  "labels": { "team": "payments", "env": "production" },
  "transport": {
    "type": "http",
    "url": "https://mcp.stripe.com",
    "headers": {
      "Authorization": "Bearer ${STRIPE_API_KEY}",
      "X-Custom": "value"
    },
    "apiKey": "${STRIPE_API_KEY}"
  }
}
```

| Field     | Type                    | Required | Notes                                                                     |
| --------- | ----------------------- | -------- | ------------------------------------------------------------------------- |
| `type`    | `"http"`                | ✅       |                                                                           |
| `url`     | string                  | ✅       | Server endpoint (must point to the MCP endpoint)                          |
| `headers` | `Record<string,string>` | —        | HTTP headers sent with every request                                      |
| `apiKey`  | string                  | —        | Shorthand for `Authorization: Bearer <key>`. Bypasses OAuth flow when set |

> **OAuth:** When `apiKey` is not set and the server returns 401, MORPH automatically initiates the OAuth 2.0 Authorization Code flow with PKCE. The server must expose a valid `/.well-known/oauth-authorization-server` endpoint and support Dynamic Client Registration.

### Transport: SSE (Server-Sent Events)

```mermaid
sequenceDiagram
    participant M as MORPH
    participant S as MCP Server
    M->>S: GET /sse
    S-->>M: SSE stream (event:endpoint, data:/mcp?sessionId=X)
    M->>S: POST /mcp?sessionId=X (JSON-RPC)
    S-->>M: 202 Accepted
    S-->>M: SSE event (JSON-RPC response)
```

```json
{
  "name": "stream-server",
  "enabled": true,
  "description": "Legacy SSE-based MCP server",
  "transport": {
    "type": "sse",
    "url": "https://example.com/sse",
    "headers": {
      "Authorization": "Bearer ${API_KEY}"
    },
    "reconnectIntervalMs": 5000
  }
}
```

| Field                 | Type                    | Required | Notes                                                    |
| --------------------- | ----------------------- | -------- | -------------------------------------------------------- |
| `type`                | `"sse"`                 | ✅       |                                                          |
| `url`                 | string                  | ✅       | SSE endpoint URL                                         |
| `headers`             | `Record<string,string>` | —        | HTTP headers for both SSE and POST requests              |
| `reconnectIntervalMs` | number                  | —        | Reconnection delay on disconnect (default SDK behaviour) |

## `toon`

| Field          | Type               | Default | Notes                        |
| -------------- | ------------------ | ------- | ---------------------------- |
| `autoConvert`  | boolean            | `true`  | Convert JSON results to TOON |
| `delimiter`    | `comma\|tab\|pipe` | `comma` | Tabular delimiter            |
| `indent`       | int 0–8            | `2`     | Spaces per level             |
| `flattenDepth` | int ≥0             | `4`     | >0 enables safe key-folding  |
| `threshold`    | int ≥0             | `100`   | Min chars before converting  |

```json
{
  "toon": {
    "autoConvert": true,
    "delimiter": "comma",
    "indent": 2,
    "flattenDepth": 4,
    "threshold": 100
  }
}
```

## `webUi`

| Field                                 | Type    | Default   | Notes                                 |
| ------------------------------------- | ------- | --------- | ------------------------------------- |
| `enabled`                             | boolean | `true`    |                                       |
| `host`                                | string  | `0.0.0.0` |                                       |
| `port`                                | int     | `3100`    |                                       |
| `publicUrl`                           | string  | —         | Public-facing URL for OAuth redirects |
| `auth.username` / `auth.passwordHash` | string  | —         | Basic Auth credentials                |

Basic Auth is enabled when `MORPH_WEB_USERNAME` (env) is set; requests to `/api/*` and `/ws` are then challenged.

```json
{
  "webUi": {
    "enabled": true,
    "host": "0.0.0.0",
    "port": 3101,
    "publicUrl": "https://morph.example.com"
  }
}
```

## `health`

| Field        | Type | Default | Notes |
| ------------ | ---- | ------- | ----- |
| `intervalMs` | int  | `30000` |       |
| `timeoutMs`  | int  | `5000`  |       |
| `maxRetries` | int  | `3`     |       |

```json
{
  "health": {
    "intervalMs": 30000,
    "timeoutMs": 5000,
    "maxRetries": 3
  }
}
```

## Complete Multi-Server Example

```json
{
  "$schema": "./schema.json",
  "morph": {
    "version": "1.0",
    "logLevel": "info",
    "allowConflicts": false
  },
  "mcpServers": [
    {
      "name": "demo-stdio",
      "enabled": true,
      "description": "Demo MCP via STDIO",
      "transport": {
        "type": "stdio",
        "command": "node",
        "args": ["dist/examples/demo-mcp-server.js"]
      }
    },
    {
      "name": "demo-http",
      "enabled": true,
      "description": "Demo MCP via HTTP",
      "transport": {
        "type": "http",
        "url": "http://localhost:3200/mcp"
      }
    },
    {
      "name": "demo-http-oauth",
      "enabled": true,
      "description": "Demo MCP via HTTP with OAuth",
      "transport": {
        "type": "http",
        "url": "http://localhost:3202/mcp",
        "apiKey": "demo-token"
      }
    },
    {
      "name": "demo-sse",
      "enabled": true,
      "description": "Demo MCP via SSE",
      "transport": {
        "type": "sse",
        "url": "http://localhost:3201/sse"
      }
    },
    {
      "name": "demo-stdio-params",
      "enabled": true,
      "description": "Demo MCP with parameterized tools",
      "transport": {
        "type": "stdio",
        "command": "node",
        "args": [
          "dist/examples/param-mcp-server.js",
          "--base-path",
          "/tmp/demo"
        ],
        "env": { "DEMO_MODE": "true" }
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
    "port": 3101
  },
  "health": {
    "intervalMs": 30000,
    "timeoutMs": 5000,
    "maxRetries": 3
  }
}
```

## Full `morph.json` Reference

```json
{
  "$schema": "./schema.json",
  "morph": {
    "version": "1.0",
    "logLevel": "info",
    "allowConflicts": false
  },
  "mcpServers": [
    {
      "name": "example",
      "enabled": true,
      "description": "Example server",
      "labels": { "env": "dev" },
      "aliases": { "read_file": "fs_read" },
      "transport": {
        "type": "stdio",
        "command": "npx",
        "args": ["-y", "@org/server"],
        "env": { "TOKEN": "${TOKEN}" },
        "cwd": "/opt/server",
        "timeoutMs": 30000
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
    "port": 3101
  },
  "health": {
    "intervalMs": 30000,
    "timeoutMs": 5000,
    "maxRetries": 3
  }
}
```

## Environment Variables

| Var                                         | Purpose                             |
| ------------------------------------------- | ----------------------------------- |
| `MORPH_CONFIG`                              | Path to `morph.json`                |
| `MORPH_DATA_DIR`                            | SQLite directory (default `./data`) |
| `MORPH_TRANSPORT`                           | `stdio` (default) or `http`         |
| `MORPH_SHUTDOWN_TIMEOUT`                    | Drain timeout ms (default `10000`)  |
| `MORPH_WEB_USERNAME` / `MORPH_WEB_PASSWORD` | Web Basic Auth                      |
| `CORS_ORIGIN`                               | Allowed origin in production        |

## Importing Existing Configs

```bash
# Claude Desktop
morph import --from ~/.config/Claude/claude_desktop_config.json

# VS Code workspace
morph import --from .vscode/mcp.json --merge ./morph.json

# GitHub Copilot CLI
morph import --from ~/.copilot/mcp-config.json --dry-run
```

`${input:*}` (VS Code) and `$COPILOT_MCP_*` (Copilot) references are surfaced as warnings to map manually — literal secrets are never copied.
