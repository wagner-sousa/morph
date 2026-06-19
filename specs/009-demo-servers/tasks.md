---
description: "Task list for Demo & Test MCP Servers (retroactive)"
---

# Tasks: Demo & Test MCP Servers

**Input**: Design documents from `/specs/009-demo-servers/`

**Prerequisites**: plan.md, spec.md

**Tests**: Included — behavior is covered by unit and integration suites.

**Organization**: Grouped by user story, ordered by implementation chronology
(commits `94e3f58` → `bf0ae4a` → `371deb5` → `217ceef` → `ac5d7f7`).

**Status**: All tasks complete (retroactive documentation of shipped work).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Could run in parallel (different files, no dependencies)
- **[Story]**: US1 (offline end-to-end) or US2 (deterministic CI backends)

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Confirm `@modelcontextprotocol/sdk` server transports available (stdio,
  streamableHttp, sse); pure-ESM `tsx` runner usable under `node:22`.
- [X] T002 Decide on `src/examples/` for demo servers and `tests/fixtures/` for the test
  fixture, kept out of the gateway runtime.

---

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T003 Establish shared server shape: `ping`/`echo`/`users` tool defs and uniform-array
  generator for TOON demonstration; all logs to stderr.

**Checkpoint**: Server scaffolding pattern ready — transport variants can be built.

---

## Phase 3: User Story 2 - Deterministic CI / integration backends (Priority: P1) 🎯 MVP

**Goal**: Real, deterministic MCP backends for tests across all three core transports.

**Independent Test**: Run the suites; servers spawn and respond to round-trip calls.

- [X] T004 [US2] Add stdio demo server in
  [src/examples/demo-mcp-server.ts](../../src/examples/demo-mcp-server.ts) (`94e3f58`).
- [X] T005 [P] [US2] Add streamable HTTP demo server (port 3200) in
  [src/examples/http-mcp-server.ts](../../src/examples/http-mcp-server.ts) (`94e3f58`).
- [X] T006 [P] [US2] Add SSE demo server (port 3201) in
  [src/examples/sse-mcp-server.ts](../../src/examples/sse-mcp-server.ts) (`94e3f58`).
- [X] T007 [US2] Add test fixture server (`echo`/`fail`/`delay`/`large_json`) in
  [tests/fixtures/test-mcp-server.ts](../../tests/fixtures/test-mcp-server.ts) and
  [tests/fixtures/morph.test.json](../../tests/fixtures/morph.test.json).
- [X] T008 [US2] Unit tests for server startup and tool calls (~8) in
  [tests/unit/demo-servers.test.ts](../../tests/unit/demo-servers.test.ts).
- [X] T009 [US2] Integration tests for real MCP round-trip routing (~5) in
  [tests/integration/tool-routing.test.ts](../../tests/integration/tool-routing.test.ts).

**Checkpoint**: CI can route real calls through local stdio/HTTP/SSE backends.

---

## Phase 4: User Story 1 - Run MORPH end-to-end offline (Priority: P1)

**Goal**: Cover auth and parameter features and wire all five servers into a one-command
demo so MORPH runs end-to-end with no external dependencies.

**Independent Test**: Start MORPH against `morph.demo.json`; list and call tools through
every transport variant including OAuth and parameterized stdio.

- [X] T010 [US1] Add HTTP + OAuth demo server (port 3202) with authorization-server
  metadata, dynamic client registration, authorize/token endpoints, and `demo-token`
  bearer/apiKey auth on `/mcp` in
  [src/examples/oauth-mcp-server.ts](../../src/examples/oauth-mcp-server.ts) (`bf0ae4a`).
- [X] T011 [P] [US1] Add stdio + parameters demo server (`--base-path`, `DEMO_MODE`,
  path-traversal denial; `read`/`write`/`list`/`stats`) in
  [src/examples/param-mcp-server.ts](../../src/examples/param-mcp-server.ts) (`bf0ae4a`).
- [X] T012 [US1] Wire all five servers as backends in `morph.demo.json` (`bf0ae4a`).

**Checkpoint**: MORPH demonstrable end-to-end across all five transport variants offline.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T013 Clean up and improve the demo HTTP server (`371deb5`).
- [X] T014 Make the demo fully offline and stream backend stderr through (`217ceef`).
- [X] T015 Run demo servers via `tsx` from source instead of compiled `dist/` in the dev
  stack and tests (`ac5d7f7`).

---

## Dependencies & Execution Order

- **Setup (Phase 1)** → **Foundational (Phase 2)** → user stories.
- **US2 (Phase 3)** shipped first (`94e3f58`): the three core transports + fixtures unblock
  CI/integration testing — the MVP.
- **US1 (Phase 4)** built on US2 (`bf0ae4a`): OAuth + parameterized servers + demo config
  complete the offline end-to-end story.
- **Polish (Phase 5)** refined and finalized the runner model (`371deb5` → `ac5d7f7`).

## Notes

- [P] tasks = different files, no dependencies.
- Servers are dev/test-only and excluded from the gateway runtime (constitution IV: stderr
  logging keeps stdio servers protocol-clean).
- `users`/`large_json` return uniform arrays to validate TOON conversion (constitution V).
