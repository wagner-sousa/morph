# Contract: Built-in MORPH Tools

**Feature**: `008-builtin-tools` | **Date**: 2026-06-16 | **Status**: Implemented

Source of truth: [src/mcp-server/builtin-tools.ts](../../../src/mcp-server/builtin-tools.ts)
(descriptors) and [src/hub.ts](../../../src/hub.ts) (`callBuiltin`, `getStatus`).

## Common behavior

- All three tools use the reserved `_morph_` name prefix and are appended to the unified
  `tools/list` (`Hub.getAllTools()`) alongside backend tools.
- Calls are detected by `isBuiltinTool(name)` and handled directly by the Hub, bypassing
  the tool router and any backend MCP client.
- Every result is a standard MCP `CallToolResult` whose single text content is a
  pretty-printed JSON payload, then passed through the TOON converter
  (`converter.convertResult`) for output consistent with backend tools (Constitution V).
- Each invocation is logged with `mcpName: "system"`, `tokensSaved: 0`, `durationMs: 0`.
- All three take no arguments — input schema is a closed empty object.

---

## `_morph_status`

**Purpose**: Report MORPH's runtime status — version, uptime, connected backend MCP
servers, and the total number of aggregated backend tools.

**Input schema**:
```json
{ "type": "object", "properties": {}, "additionalProperties": false }
```
(no arguments)

**Output** (JSON in the text content; from `Hub.getStatus()`):

| Field       | Type   | Meaning |
|-------------|--------|---------|
| `version`   | string | MORPH version (from `getVersionInfo()`) |
| `uptimeMs`  | number | Milliseconds since the Hub started |
| `mcps`      | object | Per-MCP status summary (`registry.getStatusSummary()`) |
| `toolCount` | number | Count of aggregated backend tools (excludes built-ins) |

---

## `_morph_toon_stats`

**Purpose**: Report aggregate TOON token-savings statistics for the current session.

**Input schema**:
```json
{ "type": "object", "properties": {}, "additionalProperties": false }
```
(no arguments)

**Output** (JSON in the text content; from `metrics.snapshot()` → `AggregatedStats`):

| Field               | Type   | Meaning |
|---------------------|--------|---------|
| `totalCalls`        | number | Total tool calls recorded this session |
| `failedCalls`       | number | Calls that errored |
| `totalTokensSaved`  | number | Sum of tokens saved across all conversions |
| `avgSavingsPercent` | number | Mean savings percent over converted calls (0 if none) |
| `byMcp`             | object | Per-MCP map of `{ calls, tokensSaved }` |

---

## `_morph_reload_config`

**Purpose**: Force a hot-reload of configuration from disk (`morph.json` / `.mcp.json`),
re-applying backend MCP server changes without a restart.

**Input schema**:
```json
{ "type": "object", "properties": {}, "additionalProperties": false }
```
(no arguments)

**Behavior**: Fire-and-forget — triggers `Hub.reloadFromDisk()` (which loads config and
calls `applyConfig`) and returns immediately without awaiting completion. Reload failures
surface in logs, not in the tool result.

**Output** (JSON in the text content):

| Field     | Type    | Value |
|-----------|---------|-------|
| `ok`      | boolean | `true` |
| `message` | string  | `"config reload triggered"` |
