---

description: "Task list for Persistence & Logging (retroactive)"
---

# Tasks: Persistence & Logging

**Input**: Design documents from `/specs/007-persistence-logging/`

**Prerequisites**: plan.md (required), spec.md (required for user stories)

**Tests**: Included — this subsystem has dedicated unit tests
([tests/unit/store.test.ts](tests/unit/store.test.ts),
[tests/unit/log-store.test.ts](tests/unit/log-store.test.ts)).

**Organization**: Tasks are grouped by user story and ordered by implementation
chronology (commits `b1c6515` → `e89b9a2` → `f1cca60` → `a22fe4d` → `bf1d68a`).

**Status**: All tasks complete (retroactive documentation of shipped code).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

## Path Conventions

- Single project: `src/`, `tests/` at repository root.

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Add better-sqlite3 and pino/pino-pretty dependencies (Node 22, ESM).
- [X] T002 [P] Establish `src/logging/` and `src/persistence/` module folders with
      SPEC/IMPL headers.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core stores that all user stories depend on.

- [X] T003 Define `LogEntry` / `LogFilter` contracts in
      [src/logging/store.ts](src/logging/store.ts).
- [X] T004 Implement pino logger factory writing to **stderr** in
      [src/logging/logger.ts](src/logging/logger.ts) (Constitution Principle IV).
- [X] T005 Create SQLite `Store` with `logs` + `calls` tables (WAL mode) and
      migrations in [src/persistence/store.ts](src/persistence/store.ts) (`b1c6515`).
- [X] T006 Wire both stores through the Hub (`src/hub.ts`) so calls are recorded once
      per invocation (`b1c6515`).

**Checkpoint**: Foundation ready — stores exist and are wired.

---

## Phase 3: User Story 1 - Live tool-call activity (Priority: P1) 🎯 MVP

**Goal**: Stream tool calls to the dashboard live feed as they happen.

**Independent Test**: Invoke a tool, confirm an entry streams to the live feed
immediately.

### Tests for User Story 1

- [X] T007 [P] [US1] Circular-buffer append, capacity eviction, filtering, and live
      subscription tests in
      [tests/unit/log-store.test.ts](tests/unit/log-store.test.ts) (~5 tests).

### Implementation for User Story 1

- [X] T008 [US1] Implement in-memory circular `LogStore` with `append`, `query`,
      and `onLog` subscription in [src/logging/store.ts](src/logging/store.ts).
- [X] T009 [US1] Expose live feed via `/api/logs` backed by the in-memory buffer.

**Checkpoint**: Live feed functional independently.

---

## Phase 4: User Story 2 - Query full history with savings detail (Priority: P2)

**Goal**: Durable per-call detail retrievable by id, with synchronized ids.

**Independent Test**: Record calls, fetch one by id (including after buffer cycles),
confirm full detail and that live/durable ids match.

### Tests for User Story 2

- [X] T010 [P] [US2] SQLite append/query, `getLog(id)`, filtering, and **id sync**
      tests in [tests/unit/store.test.ts](tests/unit/store.test.ts) (~18 tests).
- [X] T011 [P] [US2] Field-preservation tests (full input/output and token columns
      survive a round-trip) in
      [tests/unit/log-store.test.ts](tests/unit/log-store.test.ts).

### Implementation for User Story 2

- [X] T012 [US2] Add `input_json` / `output_text` columns, `getLog(id)`, and
      `GET /api/logs/:id` detail endpoint (`e89b9a2`).
- [X] T013 [US2] Add `raw_output` / `original_tokens` / `toon_tokens` columns for
      full before/after savings detail (`f1cca60`).
- [X] T014 [US2] Synchronize ids: write to SQLite first and reuse the returned rowId
      as the in-memory buffer id in [src/persistence/store.ts](src/persistence/store.ts)
      and [src/logging/store.ts](src/logging/store.ts) (`bf1d68a`).

**Checkpoint**: History queryable by id; live and durable ids identical.

---

## Phase 5: User Story 3 - Aggregate savings over time (Priority: P3)

**Goal**: Totals, totalizers, and hourly savings trend.

**Independent Test**: Record calls over time, read totalizers and savings history,
confirm aggregates match recorded data.

### Tests for User Story 3

- [X] T015 [P] [US3] Aggregation tests (`getStats`, `getCallTotals`, `getTotalizers`,
      `getSavingsHistory`) in [tests/unit/store.test.ts](tests/unit/store.test.ts).

### Implementation for User Story 3

- [X] T016 [US3] Implement `recordCall`, `getStats`, and `getCallTotals` over the
      `calls` table in [src/persistence/store.ts](src/persistence/store.ts).
- [X] T017 [US3] Implement hourly-bucketed `getSavingsHistory` for the stats charts.
- [X] T018 [US3] Implement `getTotalizers` (JSON tokens, TOON tokens, tokens saved,
      avg savings percent) over the `logs` table (`a22fe4d`).

**Checkpoint**: All user stories independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T019 Confirm logger never writes to stdout (stdio MCP protocol safety).
- [X] T020 Verify durable history and aggregates survive a restart (WAL persistence).

---

## Dependencies & Execution Order

- **Setup (Phase 1)** → **Foundational (Phase 2)** blocks all stories.
- **US1 (P1)** is the MVP and stands alone on the in-memory buffer.
- **US2 (P2)** and **US3 (P3)** build on the SQLite store from Phase 2; US2's id-sync
  task (T014) couples the two stores but each story remains independently testable.

## Notes

- [P] tasks touch different files with no ordering dependency.
- Tasks are ordered by shipped-commit chronology to mirror actual delivery.
- All tasks complete; this file documents the implemented subsystem retroactively.
