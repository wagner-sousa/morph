# Configuration

`morph.json` is the single source of truth, validated against `schema.json`
(generated from the zod schema via `npm run gen:schema`). All string values
support `${ENV_VAR}` interpolation, resolved from the environment / `.env`.

## Top-level

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `morph.version` | string | `"1.0"` | Schema version |
| `morph.logLevel` | `debug\|info\|warn\|error` | `info` | |
| `morph.allowConflicts` | boolean | `false` | Last MCP wins on tool-name conflict |
| `mcpServers` | `MCPDefinition[]` | `[]` | Backend MCP servers |
| `toon` | object | see below | TOON conversion options |
| `webUi` | object | see below | Web UI / API |
| `health` | object | see below | Health-check cadence |

## `mcpServers[]`

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | Unique; `[A-Za-z0-9_.-]` |
| `enabled` | boolean | Toggle without removing (default `true`) |
| `description` | string? | Human-readable |
| `labels` | `Record<string,string>?` | Metadata tags |
| `aliases` | `Record<string,string>?` | `originalName → exposedName` overrides |
| `transport` | object | One of the three below |

### Transports

```jsonc
// stdio — local process
{ "type": "stdio", "command": "npx", "args": ["-y", "pkg"],
  "env": { "K": "v" }, "cwd": "/path", "timeoutMs": 30000 }

// http — Streamable HTTP
{ "type": "http", "url": "https://host/mcp",
  "headers": { "Authorization": "Bearer ${API_KEY}" }, "apiKey": "${API_KEY}" }

// sse — legacy Server-Sent Events
{ "type": "sse", "url": "https://host/sse",
  "headers": { "Authorization": "Bearer ${API_KEY}" }, "reconnectIntervalMs": 3000 }
```

## `toon`

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `autoConvert` | boolean | `true` | Convert JSON results to TOON |
| `delimiter` | `comma\|tab\|pipe` | `comma` | Tabular delimiter |
| `indent` | int 0–8 | `2` | Spaces per level |
| `flattenDepth` | int ≥0 | `4` | >0 enables safe key-folding |
| `threshold` | int ≥0 | `100` | Min chars before converting |

## `webUi`

| Field | Type | Default |
|-------|------|---------|
| `enabled` | boolean | `true` |
| `host` | string | `0.0.0.0` |
| `port` | int | `3100` |
| `auth.username` / `auth.passwordHash` | string | — |

Basic Auth is enabled when `MORPH_WEB_USERNAME` (env) is set; requests to
`/api/*` and `/ws` are then challenged.

## `health`

| Field | Type | Default |
|-------|------|---------|
| `intervalMs` | int | `30000` |
| `timeoutMs` | int | `5000` |
| `maxRetries` | int | `3` |

## Environment variables

| Var | Purpose |
|-----|---------|
| `MORPH_CONFIG` | Path to `morph.json` |
| `MORPH_DATA_DIR` | SQLite directory (default `./data`) |
| `MORPH_TRANSPORT` | `stdio` (default) or `http` |
| `MORPH_SHUTDOWN_TIMEOUT` | Drain timeout ms (default `10000`) |
| `MORPH_WEB_USERNAME` / `MORPH_WEB_PASSWORD` | Web Basic Auth |
| `CORS_ORIGIN` | Allowed origin in production |

## Importing existing configs

`morph import --from <file> [--format claude|vscode|copilot|auto] [--merge <morph.json>] [--dry-run]`.
`${input:*}` (VS Code) and `$COPILOT_MCP_*` (Copilot) references are surfaced as
warnings to map manually — literal secrets are never copied.
