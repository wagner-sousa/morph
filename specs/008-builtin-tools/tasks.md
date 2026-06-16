---
description: "Task list for Built-in MORPH Tools (retroactive)"
---

# Tasks: Built-in MORPH Tools

**Input**: Design documents from `/specs/008-builtin-tools/`

**Prerequisites**: plan.md, spec.md, contracts/builtin-tools.md

**Tests**: Included — covered by `tests/unit/hub.test.ts` and
`tests/unit/mcp-handler.test.ts`.

**Organization**: Grouped by user story, ordered by implementation chronology
(commits b1c6515 → f276196 → e2a6d65). All tasks are complete ([X]).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Could run in parallel (different files, no dependencies)
- **[Story]**: US1 = status, US2 = toon stats, US3 = reload config

## Path Conventions

Single project: `src/`, `tests/` at repository root.

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Confirm agent-facing MCP server scaffolding exists in
  [src/mcp-server/server.ts](../../src/mcp-server/server.ts) (SDK `Server`, stdio
  transport, `ListTools`/`CallTool` handlers).
- [X] T002 Confirm Hub coordinates router, converter, metrics, and store in
  [src/hub.ts](../../src/hub.ts).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Built-in contract + dispatch plumbing all three stories depend on.

- [X] T003 [SPEC] Define built-in `Tool` descriptors, `BUILTIN_TOOL_NAMES`, and
  `isBuiltinTool()` in [src/mcp-server/builtin-tools.ts](../../src/mcp-server/builtin-tools.ts)
  with the reserved `_morph_` prefix. (commit b1c6515)
- [X] T004 Unify the tool list: `Hub.getAllTools()` appends `BUILTIN_TOOLS` to
  router-aggregated backend tools in [src/hub.ts](../../src/hub.ts). (commit b1c6515)
- [X] T005 Detect built-ins before routing in `Hub.executeCall()` and dispatch to
  `callBuiltin()`, bypassing the router/backend client. (commit b1c6515)
- [X] T006 [Constitution V] Pass every built-in result through
  `converter.convertResult()` in `callBuiltin()`/`executeCall()` so output matches
  backend formatting. (commit b1c6515)
- [X] T007 Record built-in calls in the SQLite store and live log buffer as
  `mcpName: "system"`. (commit b1c6515)
- [X] T008 Wire `tools/list` and `tools/call` SDK handlers in
  [src/mcp-server/server.ts](../../src/mcp-server/server.ts) to `Hub.getAllTools()` /
  `Hub.callTool()`. (commit b1c6515)

**Checkpoint**: Built-ins discoverable and callable; results TOON-converted.

---

## Phase 3: User Story 1 - Agent queries MORPH status (Priority: P1) 🎯 MVP

**Goal**: `_morph_status` returns version, uptime, MCP summary, tool count.

**Independent Test**: List tools, confirm `_morph_status` present; call it and verify
the snapshot fields.

### Tests for User Story 1

- [X] T009 [P] [US1] Built-in dispatch + TOON conversion of `_morph_status` result in
  [tests/unit/hub.test.ts](../../tests/unit/hub.test.ts).

### Implementation for User Story 1

- [X] T010 [US1] Implement `Hub.getStatus()` (version, uptimeMs, per-MCP summary,
  toolCount) in [src/hub.ts](../../src/hub.ts). (commit b1c6515)
- [X] T011 [US1] Map `_morph_status` → `getStatus()` in `Hub.callBuiltin()`. (commit
  b1c6515)

**Checkpoint**: US1 fully functional and independently testable.

---

## Phase 4: User Story 2 - Agent reads TOON savings stats (Priority: P2)

**Goal**: `_morph_toon_stats` returns aggregate session metrics.

**Independent Test**: Make backend calls, call `_morph_toon_stats`, confirm totals match.

### Tests for User Story 2

- [X] T012 [P] [US2] Built-in `_morph_toon_stats` snapshot conversion covered in
  [tests/unit/hub.test.ts](../../tests/unit/hub.test.ts).

### Implementation for User Story 2

- [X] T013 [US2] Map `_morph_toon_stats` → `metrics.snapshot()` (totalCalls, failedCalls,
  totalTokensSaved, avgSavingsPercent, byMcp) in `Hub.callBuiltin()`. (commit b1c6515)

**Checkpoint**: US1 + US2 both independently functional.

---

## Phase 5: User Story 3 - Agent triggers config reload (Priority: P3)

**Goal**: `_morph_reload_config` reloads config from disk and acks.

**Independent Test**: Edit config, call reload, confirm new servers via `_morph_status`.

### Tests for User Story 3

- [X] T014 [P] [US3] Built-in `_morph_reload_config` ack/conversion covered in
  [tests/unit/hub.test.ts](../../tests/unit/hub.test.ts).

### Implementation for User Story 3

- [X] T015 [US3] Map `_morph_reload_config` → fire-and-forget `Hub.reloadFromDisk()`
  returning `{ ok: true }` in `Hub.callBuiltin()`. (commit b1c6515)

**Checkpoint**: All three built-ins independently functional.

---

## Phase 6: Transport Coverage (Cross-Cutting)

**Purpose**: Expose built-ins over every supported transport.

- [X] T016 Implement direct JSON-RPC handler (`createDirectHandler`) over HTTP/SSE —
  `initialize` / `tools/list` / `tools/call` / notifications — in
  [src/mcp-server/server.ts](../../src/mcp-server/server.ts). (commit f276196)
- [X] T017 [P] JSON-RPC handler tests (initialize, tools/list incl. built-ins,
  tools/call, error codes) in
  [tests/unit/mcp-handler.test.ts](../../tests/unit/mcp-handler.test.ts). (commit f276196)
- [X] T018 Implement per-MCP direct handler (`createPerMcpDirectHandler`) scoped to a
  single backend's tools in [src/mcp-server/server.ts](../../src/mcp-server/server.ts).
  (commit e2a6d65)

---

## Phase 7: Polish & Cross-Cutting

- [X] T019 Confirm `_morph_status` emits `tools:changed`-driven `listChanged`
  notifications reflect built-ins after reload.
- [X] T020 Document the three built-in contracts in
  [contracts/builtin-tools.md](contracts/builtin-tools.md).

---

## Dependencies & Execution Order

- **Setup (Phase 1)** → **Foundational (Phase 2)** blocks all stories.
- **US1/US2/US3 (Phases 3–5)** depend on Phase 2; independently testable thereafter.
- **Transport coverage (Phase 6)** depends on Phase 2 dispatch; chronologically after
  the stories (f276196, e2a6d65 follow b1c6515).

### Parallel Opportunities

- T009, T012, T014 (tests in the same file) and T017 (separate file) were authored
  alongside their implementations.

---

## Notes

- Retroactive documentation: all tasks already complete.
- [Story] labels: US1 = `_morph_status`, US2 = `_morph_toon_stats`,
  US3 = `_morph_reload_config`.
- Constitution V is satisfied at T006 (built-in results pass through the TOON converter).
