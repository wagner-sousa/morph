---
description: "Task list for TOON Converter (retroactive, implemented)"
---

# Tasks: TOON Converter

**Input**: Design documents from `/specs/004-toon-converter/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md)

**Tests**: Included — unit tests exist for both modules.

**Organization**: Tasks grouped by user story, ordered by implementation history
df03fe5 → c76f279 → 2ca0efe. All tasks complete (retroactive documentation).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 (compact TOON), US2 (passthrough/guard), US3 (savings measurement)

## Path Conventions

Single project — `src/` and `tests/` at repository root.

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Add `@toon-format/toon` (ESM-only) dependency and `src/toon/` module dir (df03fe5)
- [X] T002 [P] Define `ToonOptions` contract in [src/config/schema.ts](../../src/config/schema.ts) / [src/config/types.ts](../../src/config/types.ts) (`indent`, `delimiter`, `flattenDepth`, `threshold`, `autoConvert`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Token-savings estimation that the converter and reporting depend on.

- [X] T003 Implement `estimateTokens` / `estimateSavings` (~4 chars/token) in [src/toon/stats.ts](../../src/toon/stats.ts) (df03fe5)
- [X] T004 Define `TokenSavings` and `ConversionResult` shapes (df03fe5)

**Checkpoint**: Savings primitives ready.

---

## Phase 3: User Story 1 - Agent receives compact TOON (Priority: P1) 🎯 MVP

**Goal**: Replace JSON text content in tool results with smaller TOON.

**Independent Test**: A backend tool returning a JSON array relays TOON-formatted, shorter content.

### Tests for User Story 1

- [X] T005 [P] [US1] Test: converts JSON array text content to TOON in [tests/unit/toon-converter.test.ts](../../tests/unit/toon-converter.test.ts) (df03fe5)
- [X] T006 [P] [US1] Test: non-text content passes through untouched in [tests/unit/toon-converter.test.ts](../../tests/unit/toon-converter.test.ts) (df03fe5)

### Implementation for User Story 1

- [X] T007 [US1] Implement `ToonConverter.encode` honoring indent/delimiter/key-folding in [src/toon/converter.ts](../../src/toon/converter.ts) (df03fe5)
- [X] T008 [US1] Implement `convertResult` iterating `content`, detecting JSON text via `isJson`, encoding to TOON in [src/toon/converter.ts](../../src/toon/converter.ts) (df03fe5)
- [X] T009 [US1] Wire converter into the Hub for backend + built-in tool results in [src/hub.ts](../../src/hub.ts) (df03fe5)

**Checkpoint**: Agents receive TOON for JSON results.

---

## Phase 4: User Story 2 - Small / non-beneficial payloads pass through (Priority: P2)

**Goal**: Never deliver a representation worse than the source JSON.

**Independent Test**: A payload whose TOON is not smaller keeps original JSON.

### Tests for User Story 2

- [X] T010 [P] [US2] Test: non-JSON text passes through unchanged in [tests/unit/toon-converter.test.ts](../../tests/unit/toon-converter.test.ts) (df03fe5)
- [X] T011 [P] [US2] Test: `maxDepth` computes nesting depth in [tests/unit/optimizer.test.ts](../../tests/unit/optimizer.test.ts) (c76f279)
- [X] T012 [P] [US2] Test: `isUniformArray` detects matching-key object arrays, rejects empty/mixed in [tests/unit/optimizer.test.ts](../../tests/unit/optimizer.test.ts) (c76f279)
- [X] T013 [P] [US2] Test: `decideConvert` skips below-threshold / scalar / deeply-nested, converts uniform & eligible in [tests/unit/optimizer.test.ts](../../tests/unit/optimizer.test.ts) (c76f279)

### Implementation for User Story 2

- [X] T014 [US2] Implement `maxDepth` and `isUniformArray` heuristics in [src/toon/optimizer.ts](../../src/toon/optimizer.ts) (c76f279)
- [X] T015 [US2] Implement `decideConvert` decision table (threshold / scalar / depth≥6 / uniform / eligible) in [src/toon/optimizer.ts](../../src/toon/optimizer.ts) (c76f279)
- [X] T016 [US2] Add size guard: keep original when TOON not strictly smaller; never break on encode error in [src/toon/converter.ts](../../src/toon/converter.ts) (df03fe5)

**Checkpoint**: Size guard and optimizer protect against regressions.

---

## Phase 5: User Story 3 - Savings measured and reported (Priority: P3)

**Goal**: Expose per-item and aggregate token savings.

**Independent Test**: Converted payload carries token counts and savings percent.

### Implementation for User Story 3

- [X] T017 [US3] Attach per-item `_meta` (`morph/format`, original/TOON tokens, savings percent) in [src/toon/converter.ts](../../src/toon/converter.ts) (df03fe5)
- [X] T018 [US3] Aggregate savings across converted items and surface via the Hub for SQLite savings history in [src/hub.ts](../../src/hub.ts) (df03fe5)

**Checkpoint**: Savings observable end to end.

---

## Phase 6: Force-Convert Refinement (post-MVP decision)

**Purpose**: Make conversion consistent on every tool call.

- [X] T019 [US1] Remove the `toon.autoConvert` branch in [src/hub.ts](../../src/hub.ts) so all results flow through the converter (2ca0efe)
- [X] T020 [US1] Remove the `decideConvert` gate from `convertResult`, leaving only the JSON check + size guard, in [src/toon/converter.ts](../../src/toon/converter.ts) (2ca0efe)
- [X] T021 [US1] Update converter tests to reflect forced conversion in [tests/unit/toon-converter.test.ts](../../tests/unit/toon-converter.test.ts) (2ca0efe)

**Checkpoint**: TOON forced on 100% of MCP tool results; `optimizer.ts` retained as a library.

---

## Dependencies & Execution Order

- **Setup (Phase 1)** → **Foundational (Phase 2)** → **US1 (Phase 3)** → **US2/US3** →
  **Force-Convert (Phase 6)**.
- US2's optimizer (c76f279) builds on US1's converter (df03fe5).
- Phase 6 (2ca0efe) supersedes the autoConvert/decideConvert gating from earlier phases.

### Within Each User Story

- Tests written alongside implementation (one `*.test.ts` per module per constitution III).
- `stats.ts` (foundational) before converter; optimizer before its removal from the gate.

---

## Notes

- [P] tasks = different files, no dependencies.
- ~4 converter tests, ~16 optimizer tests.
- The optimizer remains in the codebase as reusable heuristics even though the forced path
  (2ca0efe) no longer calls `decideConvert` from `convertResult`.
