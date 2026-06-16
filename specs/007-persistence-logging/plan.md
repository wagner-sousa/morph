# Implementation Plan: Persistence & Logging

**Branch**: `007-persistence-logging` | **Date**: 2026-06-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/007-persistence-logging/spec.md`

## Summary

MORPH needs both immediate visibility into tool-call activity and a durable,
queryable record of it with token-savings detail. The implementation uses **two
log stores**: an in-memory circular buffer (`LogStore`) that powers the live feed
(`/api/logs`) and a SQLite-backed store (`Store`, better-sqlite3) that persists
call history plus a per-call time series for aggregation and detail lookup
(`/api/logs/:id`).

The key design decision is **id synchronization between the two stores**: an entry
is written to SQLite first, and the returned `rowId` is reused as the in-memory
buffer's id (commit `bf1d68a`). This guarantees an id seen in the live feed resolves
to the same durable record, with no separate id space. The structured logger writes
to **stderr** so it never corrupts the stdio MCP protocol on stdout.

## Technical Context

**Language/Version**: TypeScript (ESM, `NodeNext`) on Node 22

**Primary Dependencies**: better-sqlite3 (durable store), pino + pino-pretty (logger)

**Storage**: SQLite (`logs` + `calls` tables, WAL mode) for durable history; an
in-memory circular buffer for the live hot path

**Testing**: Vitest (`tests/unit/store.test.ts`, `tests/unit/log-store.test.ts`)

**Target Platform**: Linux container (`node:22`), Docker-first

**Project Type**: Single project (MCP gateway service)

**Performance Goals**: Live append/stream within the call cycle; synchronous SQLite
writes acceptable at gateway call rates

**Constraints**: Logger output MUST stay on stderr; stdout reserved for MCP stdio

**Scale/Scope**: Single instance, local store; live buffer bounded (default 1000)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Contract-First (Zod)**: No configuration shape changes in this feature;
      `src/config/schema.ts` and generated schemas are untouched. N/A — compliant.
- [x] **II. SPEC vs IMPL**: `src/logging/store.ts` carries `SPEC + IMPL` (it defines
      `LogEntry`/`LogFilter` contracts inline); `src/persistence/store.ts` and
      `src/logging/logger.ts` carry `IMPL` headers.
- [x] **III. Test-First / one test per module**: `tests/unit/store.test.ts` and
      `tests/unit/log-store.test.ts` sit beside their modules and cover persistence,
      id sync, and field preservation.
- [x] **IV. Docker-First / Pure ESM**: builds/tests run in `node:22`; intra-package
      imports use `.js` extensions; the logger writes to **stderr** (Principle IV) so
      stdout stays clean for the MCP stdio transport.
- [x] **V. Token Savings**: this feature measures and persists savings (original vs
      TOON token counts, totalizers, hourly trend); it adds no path that bypasses the
      converter, so there is no regression to the savings goal.

No violations — Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/007-persistence-logging/
├── plan.md      # This file
├── spec.md      # Feature specification
└── tasks.md     # Task breakdown
```

No `contracts/` or `data-model.md`: this feature introduces no configuration schema
changes, so there is no zod contract to view (per Principle I / constitution rules).

### Source Code (repository root)

```text
src/
├── logging/
│   ├── store.ts     # In-memory circular LogStore + live subscription (LogEntry, LogFilter)
│   └── logger.ts    # Pino logger factory; writes to stderr (fd 2)
└── persistence/
    └── store.ts     # SQLite Store: logs + calls tables, totalizers, savings history

tests/
└── unit/
    ├── store.test.ts        # SQLite store + id sync (~18 tests)
    └── log-store.test.ts    # circular buffer id + field preservation (~5 tests)
```

**Structure Decision**: Single-project layout. The durable store lives at
[src/persistence/store.ts](src/persistence/store.ts); the live buffer and logger
live at [src/logging/store.ts](src/logging/store.ts) and
[src/logging/logger.ts](src/logging/logger.ts). Both stores are wired through the
Hub (`src/hub.ts`), which records each call into SQLite first and feeds the returned
rowId into the in-memory buffer.

## Implementation Notes (chronological commits)

- `b1c6515` — Hub wiring + initial SQLite persistence layer.
- `e89b9a2` — Added `input_json` / `output_text` columns, `GET /api/logs/:id` detail
  endpoint, and call totals.
- `f1cca60` — Added `raw_output` / `original_tokens` / `toon_tokens` columns for full
  before/after savings detail.
- `a22fe4d` — Added totalizers (aggregate JSON/TOON tokens, tokens saved, avg percent).
- `bf1d68a` — Synchronized ids between `LogStore` and SQLite by writing to SQLite first
  and reusing the returned rowId in the in-memory buffer.

## Complexity Tracking

> No Constitution Check violations — table intentionally empty.
