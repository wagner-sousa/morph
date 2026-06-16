# Feature Specification: Built-in MORPH Tools

**Feature Branch**: `008-builtin-tools`

**Created**: 2026-06-16

**Status**: Implemented

**Input**: Document retroactively MORPH's own built-in tools (`_morph_status`,
`_morph_toon_stats`, `_morph_reload_config`) exposed to the agent alongside backend
tools, so an agent can introspect and operate the gateway as ordinary MCP tools.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Agent queries MORPH's own status (Priority: P1)

An AI agent connected to MORPH wants to know what the gateway is currently doing:
which backend MCP servers are connected, how many tools are aggregated, and how long
MORPH has been running. It calls `_morph_status` — a tool that appears in the normal
`tools/list` response next to every backend tool — and receives a structured snapshot.

**Why this priority**: Introspection is the foundational built-in. Without knowing
which servers are up and how many tools exist, neither stats nor reload are meaningful.

**Independent Test**: List tools and confirm `_morph_status` appears; call it and
verify the result reports version, uptime, per-MCP status, and tool count.

**Acceptance Scenarios**:

1. **Given** MORPH is running with one or more backend MCPs, **When** the agent calls
   `tools/list`, **Then** `_morph_status` appears in the unified tool list alongside
   backend tools.
2. **Given** the agent calls `_morph_status` with no arguments, **When** the call
   resolves, **Then** the result contains MORPH version, uptime, connected MCP
   summary, and the total aggregated tool count.

---

### User Story 2 - Agent reads TOON savings statistics (Priority: P2)

An agent (or a human via an agent) wants to see how much MORPH's TOON conversion has
saved this session. It calls `_morph_toon_stats` and receives aggregate metrics: total
calls, failed calls, total tokens saved, average savings percent, and a per-MCP
breakdown.

**Why this priority**: Surfaces the product goal (token savings) directly to the agent,
but depends on the introspection plumbing established by US1.

**Independent Test**: Make a few backend tool calls, then call `_morph_toon_stats` and
confirm the returned totals reflect the calls just made.

**Acceptance Scenarios**:

1. **Given** at least one backend tool has been called this session, **When** the agent
   calls `_morph_toon_stats`, **Then** the result reports `totalCalls`,
   `totalTokensSaved`, `avgSavingsPercent`, and a `byMcp` breakdown.
2. **Given** no calls have been made, **When** the agent calls `_morph_toon_stats`,
   **Then** the result returns zeroed totals without error.

---

### User Story 3 - Agent triggers a config reload (Priority: P3)

An agent wants MORPH to pick up an edited `morph.json` / `.mcp.json` without a restart.
It calls `_morph_reload_config`; MORPH reloads configuration from disk and hot-applies
backend MCP changes, returning an acknowledgement immediately.

**Why this priority**: Operational convenience; valuable but not required for the MVP of
agent-facing introspection.

**Independent Test**: Edit config on disk, call `_morph_reload_config`, then call
`_morph_status` and confirm the new server set is reflected.

**Acceptance Scenarios**:

1. **Given** MORPH is running, **When** the agent calls `_morph_reload_config`, **Then**
   the call returns an acknowledgement (`ok: true`) and a reload is triggered.
2. **Given** a backend MCP was added on disk, **When** reload completes, **Then** the
   new server's tools appear in a subsequent `tools/list`.

### Edge Cases

- What happens when a built-in name collides with a backend tool? The `_morph_` prefix
  is reserved and built-ins are detected before routing, so they always win and never
  reach the router.
- How does the system handle an unknown `_morph_*`-shaped name? Only the three known
  names are treated as built-ins; any other name falls through to normal routing and a
  "Tool not found" error.
- What happens when reload fails mid-flight? The acknowledgement is returned immediately
  (fire-and-forget); reload failures are logged and the previous config remains active.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: MORPH MUST expose three built-in tools — `_morph_status`,
  `_morph_toon_stats`, `_morph_reload_config` — in the unified `tools/list` response
  alongside all backend tools.
- **FR-002**: Built-in tools MUST use the reserved `_morph_` name prefix to avoid
  clashing with backend tool names.
- **FR-003**: Built-in tool calls MUST be detected before routing and handled directly
  by the Hub, bypassing the tool router and any backend MCP client.
- **FR-004**: `_morph_status` MUST report MORPH version, uptime, a per-MCP connection
  summary, and the aggregated backend tool count.
- **FR-005**: `_morph_toon_stats` MUST report aggregate session metrics: total calls,
  failed calls, total tokens saved, average savings percent, and a per-MCP breakdown.
- **FR-006**: `_morph_reload_config` MUST trigger a reload of configuration from disk and
  return an acknowledgement.
- **FR-007**: Every built-in result MUST pass through the TOON converter, identical to
  backend results, so output formatting is consistent.
- **FR-008**: Built-in calls MUST be recorded in the log store (`mcpName: "system"`) so
  they are visible in logs like any other call.
- **FR-009**: The agent MUST be able to invoke built-ins over every supported transport:
  the SDK stdio server, the direct JSON-RPC handler over HTTP/SSE, and the per-MCP
  direct handler.

### Key Entities

- **Built-in tool**: A MORPH-owned MCP tool, prefixed `_morph_`, with an empty input
  schema, handled directly by the Hub rather than a backend MCP. Defined as a static
  `Tool` descriptor plus a Hub dispatch case.
- **Unified tool list**: The single tool list returned to the agent, formed by
  concatenating router-aggregated backend tools with the static built-in tools.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All three built-ins appear in `tools/list` on every transport in 100% of
  sessions where MORPH is running.
- **SC-002**: A `_morph_status` call returns a complete snapshot (version, uptime, MCP
  summary, tool count) with zero backend MCP round-trips.
- **SC-003**: `_morph_toon_stats` totals match the recorded call history for the session
  (no drift between built-in output and metrics snapshot).
- **SC-004**: `_morph_reload_config` acknowledges in under one round-trip and reflected
  config changes are visible in a subsequent `_morph_status`/`tools/list`.

## Assumptions

- Agents address built-ins by their exact `_morph_` names; no aliasing is applied.
- Built-in tools take no arguments (empty object input schema).
- Reload is fire-and-forget from the agent's perspective; durable failure reporting is
  via logs, not the tool result.
