---
description: "Task list for the Tool Router feature"
---

# Tasks: Tool Router

**Input**: Design documents from `/specs/003-tool-router/`

**Prerequisites**: plan.md (required), spec.md (required for user stories)

**Tests**: Included — the module has a sibling Vitest suite per Constitution Principle III.

**Organization**: Tasks are grouped by user story. All tasks are complete (retroactive
documentation). Implementation order follows commits df03fe5 → 73404fe.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 (unified list), US2 (conflict resolution), US3 (operator renaming)

## Path Conventions

- Single project: `src/`, `tests/` at repository root.

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Confirm pure-ESM module layout under `src/router/` (Node 22, `.js` imports).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The routing contract every user story depends on.

- [X] T002 Define the SPEC routing contract (`RouteEntry`, `ResolvedRoute`, `RouterInput`)
      in [src/router/types.ts](../../src/router/types.ts). *(df03fe5)*
- [X] T003 Scaffold the `Router` class with `routes`/`toolDefs` maps and stderr logger in
      [src/router/index.ts](../../src/router/index.ts). *(df03fe5)*

**Checkpoint**: Contract and class skeleton ready — user stories can proceed.

---

## Phase 3: User Story 1 - Unified tool list (Priority: P1) 🎯 MVP

**Goal**: Aggregate all backend tools into one list and resolve each call to its backend.

**Independent Test**: List tools across two non-conflicting backends; confirm each resolves.

### Tests for User Story 1

- [X] T004 [US1] Unit tests "routes non-conflicting tools by their original name",
      "throws ToolNotFoundError for unknown tools" in
      [tests/unit/router.test.ts](../../tests/unit/router.test.ts). *(df03fe5)*

### Implementation for User Story 1

- [X] T005 [US1] Build candidate list from `toolsByMcp` and group by desired exposed name
      in `buildRoutes` (`src/router/index.ts`). *(df03fe5)*
- [X] T006 [US1] Register single-candidate groups under their original name; implement
      `register`, `resolve`, `has`, `getAllTools`, `getRouteTable` (`src/router/index.ts`). *(df03fe5)*
- [X] T007 [US1] Raise `ToolNotFoundError` on unknown names in `resolve`
      (`src/router/index.ts`). *(df03fe5)*

**Checkpoint**: Aggregation and resolution work for non-conflicting backends.

---

## Phase 4: User Story 2 - Deterministic conflict resolution (Priority: P1)

**Goal**: Resolve same-name clashes by the fixed 4-step order.

**Independent Test**: Two backends with the same tool name resolve per the documented order.

### Tests for User Story 2

- [X] T008 [US2] Unit tests "auto-prefixes conflicting tool names" and
      "last wins when allowConflicts is true" in
      [tests/unit/router.test.ts](../../tests/unit/router.test.ts). *(df03fe5)*

### Implementation for User Story 2

- [X] T009 [US2] Auto-prefix unresolved conflicts as `${mcp}_${tool}` with numeric-suffix
      uniqueness guard (`src/router/index.ts`). *(df03fe5)* — step 3.
- [X] T010 [US2] `allowConflicts` last-wins branch with logged warning
      (`src/router/index.ts`). *(df03fe5)* — step 4.

**Checkpoint**: Conflicts resolve deterministically via auto-prefix and last-wins.

---

## Phase 5: User Story 3 - Operator renaming (Priority: P2)

**Goal**: Rename tools via per-backend `aliases` and a global `toolPrefix` template.

**Independent Test**: Set an alias and a `{name}_`/`{name}:` prefix; confirm exposed names.

### Tests for User Story 3

- [X] T011 [US3] Unit test "honours user aliases" in
      [tests/unit/router.test.ts](../../tests/unit/router.test.ts). *(df03fe5)*
- [X] T012 [US3] Unit tests for `toolPrefix` templates (`{name}_`, `{name}:`, `{name}.`),
      prefix-over-allowConflicts precedence, empty-prefix default, and prefixed
      `getAllTools` in [tests/unit/router.test.ts](../../tests/unit/router.test.ts). *(73404fe)*

### Implementation for User Story 3

- [X] T013 [US3] Honour explicit `aliases` as the highest-priority exposed name (step 1)
      in candidate construction (`src/router/index.ts`). *(df03fe5)*
- [X] T014 [US3] Add the `toolPrefix` template `applyPrefix` rendering the `{name}` token
      and forcing prefixing of all tools (step 2, precedence over auto-prefix/last-wins)
      in `src/router/index.ts`. *(73404fe)*

**Checkpoint**: All four conflict steps and operator renaming are functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T015 Clear `routes`/`toolDefs` on every `buildRoutes` call for clean hot-reload
      (`src/router/index.ts`). *(df03fe5)*
- [X] T016 Emit info/warn logs (route count, conflict/prefix reasons) to stderr
      (`src/router/index.ts`). *(df03fe5, 73404fe)*

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (P1)** → **Foundational (P2)** → user stories.
- **US1 (P3 phase)**: depends on Foundational only — MVP.
- **US2 / US3**: build on US1's `buildRoutes` grouping; ordered by commit df03fe5 → 73404fe.
- **Polish (P6)**: after all stories.

### Within Each User Story

- Tests precede/accompany implementation (Principle III).
- Contract (`types.ts`) before implementation (`index.ts`).

---

## Implementation Strategy

1. Foundational contract + Router skeleton.
2. US1 (aggregation + resolution) → MVP.
3. US2 (auto-prefix, last-wins) — df03fe5.
4. US3 (aliases + `toolPrefix` template) — alias in df03fe5, template added in 73404fe.
5. Polish: reload safety and logging.

---

## Notes

- [Story] labels map tasks to spec user stories US1–US3.
- Commit tags `(df03fe5)` / `(73404fe)` record the actual delivery order.
- All tasks marked [X]: retroactive documentation of an implemented feature.
