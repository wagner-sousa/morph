# Data Model: Config System

**Branch**: `005-config-system` | **Date**: 2026-06-16
**Derived from**: [src/config/schema.ts](../../src/config/schema.ts) (the executable zod
contract), [src/config/types.ts](../../src/config/types.ts) (inferred types), and
[src/config/paths.ts](../../src/config/paths.ts) (on-disk path resolution).

> **Source of truth caveat (Constitution Principle I).** This document is a *human-readable
> view* of the zod schemas in `src/config/schema.ts`. The zod schema is the executable
> contract; `schema.json` / `mcp.schema.json` are generated from it via
> `npm run gen:schema`. If this file and `schema.ts` ever disagree, **`schema.ts` wins** —
> update this view, never hand-edit the generated JSON. Line numbers below refer to
> `schema.ts` as merged with `main` (post-Prettier).

## Files on disk

| File | Zod schema | Purpose |
|------|-----------|---------|
| `morph.json` | `MorphFileSchema` (`schema.json`) | Gateway behavior: `morph`, `toon`, `webUi`, `health` |
| `.mcp.json` | `McpFileSchema` (`mcp.schema.json`) | Backend MCP servers, Claude-style keyed map |

At load time the two are merged into the in-memory `MorphConfigSchema` — the shape the rest
of the codebase consumes (`schema.ts:170`). Both files are committed in two flavors:
`*.example.json` (templates) and `*.demo.json` (power the dev stack).

## Path & environment resolution — `paths.ts`

A single data directory holds everything MORPH persists, so Docker needs only one volume
mount. Resolved by `resolvePaths()` (`paths.ts:50`) into `ResolvedPaths`
(`paths.ts:22`): `{ dataDir, configPath, mcpPath, logDir }`.

| Path | Env override | Default | Notes |
|------|--------------|---------|-------|
| `dataDir` | `MORPH_DATA_DIR` | `./data` | Root for SQLite DB, OAuth sessions, logs, optional config |
| `configPath` | `MORPH_CONFIG` (or `--config`) | `${dataDir}/morph.json` → else `./morph.json` | Explicit flag/env wins |
| `mcpPath` | `MORPH_MCP_CONFIG` (or `--mcp-config`) | sibling of config | `morph<suffix>.json` → `.mcp<suffix>.json` |
| `logDir` | `MORPH_LOG_DIR` | `${dataDir}/logs` | Optional file logs |

The `.mcp.json` sibling derivation (`resolveMcpConfigPath`, `paths.ts:37`) keeps the suffix
in sync: `morph.demo.json` → `.mcp.demo.json`, `morph.json` → `.mcp.json`.

## Shared primitives

- **`NameSchema`** (`schema.ts:18`) — non-empty string matching `^[a-zA-Z0-9_.-]+$`. Used
  for MCP names and keys.
- **`LOG_LEVELS`** = `debug | info | warn | error` (`schema.ts:15`).
- **`DELIMITER_NAMES`** = `comma | tab | pipe` (`schema.ts:16`).

## Entities

### Transport (discriminated union by `type`) — `TransportSchema` (`schema.ts:49`)

The internal, explicit transport. One of:

| Variant | Schema | Required | Optional |
|---------|--------|----------|----------|
| `stdio` | `StdioTransportSchema` (`:26`) | `command` (non-empty) | `args` (default `[]`), `env`, `cwd`, `timeoutMs` (int >0) |
| `http` | `HttpTransportSchema` (`:35`) | `url` (valid URL) | `headers`, `apiKey` |
| `sse` | `SseTransportSchema` (`:42`) | `url` (valid URL) | `headers`, `reconnectIntervalMs` (int >0) |

### MCP server entry (on-disk, flat) — `McpServerEntrySchema` (`schema.ts:71`)

The Claude-style flat shape written in `.mcp.json`. The transport is **inferred** from the
fields. `superRefine` (`schema.ts:89`) enforces:
- `type` defaults to `stdio`; a `stdio` entry **requires `command`**.
- an `http` or `sse` entry **requires `url`**.

Fields: `type?`, `command?`, `args?`, `env?`, `cwd?`, `timeoutMs?`, `url?`, `headers?`,
`apiKey?`, `reconnectIntervalMs?`, plus MORPH extensions `enabled?`, `description?`,
`labels?`, `aliases?`. The file wrapper is `McpFileSchema` (`schema.ts:106`).

### MCP definition (internal, post-merge) — `MCPDefinitionSchema` (`schema.ts:56`)

The normalized form with an explicit `transport`: `name` (`NameSchema`), `enabled`
(default `true`), `description?`, `labels?`, `aliases?` (rename map, e.g.
`{ "read_file": "fs_read" }`), `transport` (`TransportSchema`).

Disk ↔ memory conversion is bidirectional and lossless for supported fields:
- `toMcpDefinitions(servers)` (`schema.ts:229`) — `.mcp.json` map → `MCPDefinition[]`.
- `fromMcpDefinitions(defs)` (`schema.ts:194`) — `MCPDefinition[]` → `.mcp.json` map.

### Settings sub-objects (all with defaults)

| Entity | Schema | Key fields (with defaults / ranges) |
|--------|--------|-------------------------------------|
| Morph settings | `MorphSettingsSchema` (`:144`) | `version` (`"1.0"`), `logLevel` (`info`), `allowConflicts` (`false`), `toolPrefix` (`""`, template where `{name}` → MCP name) |
| TOON options | `ToonOptionsSchema` (`:111`) | `autoConvert` (`true`), `delimiter` (`comma`), `indent` (int 0–8, `2`), `flattenDepth` (int ≥0, `4`), `threshold` (int ≥0, `100`) |
| Web UI | `WebUiSchema` (`:121`) | `enabled` (`true`), `host` (`0.0.0.0`), `port` (int 1–65535, `3100`), `publicUrl?` (URL), `auth?` (`{username, passwordHash}`) |
| Health | `HealthSchema` (`:136`) | `intervalMs` (int >0, `30000`), `timeoutMs` (int >0, `5000`), `maxRetries` (int ≥0, `3`) |

### Merged config — `MorphConfigSchema` (`schema.ts:170`)

`{ morph, mcpServers: MCPDefinition[], toon, webUi, health }`. Its `superRefine`
(`schema.ts:179`) rejects **duplicate MCP names**, reporting the offending
`mcpServers[i].name` path.

## Validation summary (what gets rejected)

- Empty or non-pattern MCP names (`NameSchema`).
- `stdio` server without `command`; `http`/`sse` server without `url` (`superRefine`).
- Out-of-range `indent` (>8), `port` (outside 1–65535), non-positive interval/timeout.
- Unknown delimiter / log level (enum).
- Duplicate MCP names after merge.

## Related

- Loading + `${ENV}` value resolution: `src/config/loader.ts`, `src/utils/env.ts`.
- Path/data-dir resolution: `src/config/paths.ts` (tested in
  [tests/unit/paths.test.ts](../../tests/unit/paths.test.ts)).
- Hot-reload: `src/config/watcher.ts` (chokidar, debounced, emits only validated configs).
- Cross-references: transports feed [001-mcp-client-transports](../001-mcp-client-transports/spec.md);
  `toolPrefix`/`aliases` feed [003-tool-router](../003-tool-router/spec.md);
  `toon.*` feeds [004-toon-converter](../004-toon-converter/spec.md);
  `webUi` feeds [006-web-api-studio](../006-web-api-studio/spec.md);
  the single data dir feeds [010-docker-ci](../010-docker-ci/spec.md).
