---
description: "Task list for MCP Client Transports & Registry (retroactive — all complete)"
---

# Tasks: MCP Client Transports & Registry

**Input**: Design documents from `/specs/001-mcp-client-transports/`

**Prerequisites**: plan.md (required), spec.md (required for user stories)

**Tests**: Included — registry lifecycle is covered by one unit test module.

**Organization**: Tasks are grouped by user story and ordered by the actual git
chronology (`d50c6a1` → `217ceef` → `16c2aac`). All tasks are complete `[X]`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Could run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

## Path Conventions

- Single project: `src/`, `tests/` at repository root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Connection-layer foundations under `src/mcp-client/`.

- [X] T001 Establish `src/mcp-client/` module layout (pure ESM, `.js` import
      extensions, `SPEC:`/`IMPL:` headers) per plan.md. (`d50c6a1`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The client contract and shared base behavior that every transport
and the registry depend on.

**⚠️ CRITICAL**: No transport or registry work can begin until this is complete.

- [X] T002 Define the `MCPClient` contract (status/event types, `ClientOptions`,
      OAuth hooks) in [src/mcp-client/types.ts](src/mcp-client/types.ts) — SPEC.
      (`d50c6a1`)
- [X] T003 Implement shared client behavior (connect with bounded retry,
      disconnect, list/call tools, status, last error, lifecycle events,
      transport-close handling) in
      [src/mcp-client/base-client.ts](src/mcp-client/base-client.ts). (`d50c6a1`)

**Checkpoint**: Contract + base behavior ready — transports can now be added.

---

## Phase 3: User Story 1 - Connect over any supported transport (Priority: P1) 🎯 MVP

**Goal**: Connect to backends over stdio, Streamable HTTP, and SSE behind one
contract, and proxy tool calls.

**Independent Test**: Configure one stdio and one remote backend, start MORPH,
confirm both connect and list tools.

### Implementation for User Story 1

- [X] T004 [P] [US1] Implement stdio transport client (spawn child process with
      command/args/cwd/env) in
      [src/mcp-client/stdio-client.ts](src/mcp-client/stdio-client.ts).
      (`d50c6a1`)
- [X] T005 [P] [US1] Implement Streamable HTTP transport client (URL, headers,
      API-key bearer) in
      [src/mcp-client/http-client.ts](src/mcp-client/http-client.ts). (`d50c6a1`)
- [X] T006 [P] [US1] Implement legacy SSE transport client (URL + injected auth
      headers) in [src/mcp-client/sse-client.ts](src/mcp-client/sse-client.ts).
      (`d50c6a1`)
- [X] T007 [US1] Implement the transport-type factory (exhaustive switch, error
      on unknown type) in
      [src/mcp-client/factory.ts](src/mcp-client/factory.ts). (`d50c6a1`)

**Checkpoint**: All three transports connect and proxy tool calls independently.

---

## Phase 4: User Story 2 - Manage connection lifecycle at runtime (Priority: P2)

**Goal**: Central registry with runtime add/remove/update/reconnect, failure
isolation, retry, and tool caching.

**Independent Test**: Start with several backends, then add/update/remove one at
runtime; the others stay connected.

### Tests for User Story 2

- [X] T008 [US2] Registry lifecycle tests (initialize, add, connect/disconnect,
      reconnect/update, failure isolation; ~6 tests) in
      [tests/unit/mcp-connection.test.ts](tests/unit/mcp-connection.test.ts).
      (`d50c6a1`)

### Implementation for User Story 2

- [X] T009 [US2] Implement `MCPClientRegistry` — owns clients + definitions +
      cached tools; supports initialize/add/connect/disconnect/remove/update,
      isolates per-backend failures, re-emits lifecycle events, refreshes tools
      with ping latency, exposes status summary — in
      [src/mcp-client/registry.ts](src/mcp-client/registry.ts). (`d50c6a1`)

**Checkpoint**: Backends can be hot add/update/removed without affecting others.

---

## Phase 5: User Story 3 - Skip disabled backends & surface diagnostics (Priority: P3)

**Goal**: Register disabled backends without connecting or requiring credentials,
stream backend stderr, and expose health/status.

**Independent Test**: Mark a backend disabled with no credentials; MORPH starts
cleanly and never attempts to connect it.

### Implementation for User Story 3

- [X] T010 [US3] Register disabled backends without connecting and without
      requiring their env/credentials (registry `add` short-circuits on
      `!enabled`) in
      [src/mcp-client/registry.ts](src/mcp-client/registry.ts). (`217ceef`)
- [X] T011 [US3] Stream stdio backend stderr (`stderr: 'inherit'`) for
      troubleshooting / offline demo in
      [src/mcp-client/stdio-client.ts](src/mcp-client/stdio-client.ts).
      (`217ceef`)

**Checkpoint**: Disabled backends skipped; backend logs and status observable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Surface OAuth hooks for HTTP backends (full flow in spec 002).

- [X] T012 [US3] Surface HTTP OAuth hooks (`needsOAuth`/`getAuthorizationUrl`/
      `hasOAuthToken`/`finishOAuth`) on the client and wire OAuth provider lookup
      + status fields into the registry, in
      [src/mcp-client/http-client.ts](src/mcp-client/http-client.ts) and
      [src/mcp-client/registry.ts](src/mcp-client/registry.ts). OAuth store/
      provider/flow specified in spec 002. (`16c2aac`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories (the
  contract and base class are required by every transport and the registry).
- **User Story 1 (Phase 3)**: Depends on Foundational.
- **User Story 2 (Phase 4)**: Depends on Foundational + US1 (registry creates
  clients via the factory).
- **User Story 3 (Phase 5)**: Depends on US2 (disabled-skip / status live in the
  registry; stderr streaming on the stdio client).
- **Polish (Phase 6)**: Depends on US1 (HTTP client) + US2 (registry).

### Within Each User Story

- Contract → tests → implementation.
- Base behavior before transport subclasses; transports before factory; factory
  before registry.

### Parallel Opportunities

- T004, T005, T006 (the three transport clients) are independent files and could
  be built in parallel once the base class (T003) exists.

---

## Implementation Strategy

1. Phase 1–2: contract + shared base (`d50c6a1`).
2. Phase 3 (US1, MVP): three transports + factory — connect and proxy.
3. Phase 4 (US2): registry lifecycle + tests.
4. Phase 5 (US3): disabled-skip + stderr streaming (`217ceef`).
5. Phase 6: OAuth hooks integration (`16c2aac`; flow in spec 002).

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps each task to a user story for traceability.
- All tasks complete — this is a retroactive backlog of shipped work.
