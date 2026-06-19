---
description: "Task list for the configuration system (retroactive)"
---

# Tasks: Configuration System

**Input**: Design documents from `/specs/005-config-system/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), data-model.md

**Tests**: Included — the config layer is covered by unit tests per Constitution Principle III.

**Organization**: Tasks are grouped by user story and ordered chronologically by the commits
that delivered them. All tasks are complete (`[X]`).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)

## Path Conventions

- Single project: `src/`, `tests/` at repository root.

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Establish `src/config/` module under pure-ESM TypeScript (Node 22, `NodeNext`).
- [X] T002 [P] Add `zod`, `chokidar`, and `zod-to-json-schema` dependencies.
- [X] T003 [P] Wire `gen:schema` script (`scripts/gen-schema.ts`) to generate JSON Schemas
      from the zod schema.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The executable contract and shared resolution logic every story builds on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 Define the executable zod config schema (single source of truth) in
      [src/config/schema.ts](src/config/schema.ts). *(commit d5c2976)*
- [X] T005 Derive TypeScript types via `z.infer` in [src/config/types.ts](src/config/types.ts).
      *(commit d5c2976)*
- [X] T006 Implement the `ConfigError` / `EnvResolutionError` types for clear failures.
      *(commit d5c2976)*

**Checkpoint**: Contract and types exist — user story implementation can begin.

---

## Phase 3: User Story 1 - Configure gateway and backends in two editable files (Priority: P1) 🎯 MVP

**Goal**: Load gateway settings and the backend inventory from two human-editable files,
applying defaults and rejecting duplicates.

**Independent Test**: Place a valid gateway file and backends file on disk, start the
gateway, confirm declared settings apply and enabled backends register.

### Tests for User Story 1

- [X] T007 [P] [US1] Loader tests: valid load, defaults applied, duplicate-name rejection,
      disabled-backend handling in [tests/unit/config-loader.test.ts](tests/unit/config-loader.test.ts). *(commit d5c2976)*

### Implementation for User Story 1

- [X] T008 [US1] Implement `loadConfig` / `parseConfig` / `validateConfig` in
      [src/config/loader.ts](src/config/loader.ts) (read file, validate against zod, format
      all issues into one message). *(commit d5c2976)*
- [X] T009 [US1] Enforce unique backend names and apply defaults via the schema's
      `superRefine` and `.default()`s in [src/config/schema.ts](src/config/schema.ts). *(commit d5c2976)*
- [X] T010 [US1] Split configuration into `morph.json` (gateway, `schema.json`) and
      `.mcp.json` (backends, Claude-style keyed object, `mcp.schema.json`). *(commit 5be6fb9)*
- [X] T011 [US1] Add `morph.toolPrefix` template setting for prefixing exposed tool names in
      [src/config/schema.ts](src/config/schema.ts). *(commit 73404fe)*

**Checkpoint**: Gateway loads both files, applies defaults, rejects duplicate backends.

---

## Phase 4: User Story 2 - Change configuration without restarting (Priority: P1)

**Goal**: Apply valid file edits live, debounced, retaining last known-good on error.

**Independent Test**: Start the gateway, save a watched file, observe the change take effect
within ~1s without a restart.

### Tests for User Story 2

- [X] T012 [US2] Loader/watcher coverage for reload behavior and invalid-edit retention
      within [tests/unit/config-loader.test.ts](tests/unit/config-loader.test.ts). *(commit d5c2976)*

### Implementation for User Story 2

- [X] T013 [US2] Implement `ConfigWatcher` (chokidar, `awaitWriteFinish`, debounced
      reload, emits only validated configs, `error` on failure) in
      [src/config/watcher.ts](src/config/watcher.ts). *(commit d5c2976)*

**Checkpoint**: Valid live edits apply without restart; invalid edits keep the prior config.

---

## Phase 5: User Story 3 - Keep secrets out of config via env placeholders (Priority: P2)

**Goal**: Resolve `${VAR}` placeholders at load; fail on missing vars for global/enabled
backends; leave disabled-backend placeholders intact.

**Independent Test**: Reference a variable in a file, set it, load, confirm the resolved
value is used; unset it for an enabled backend and confirm a clear failure.

### Tests for User Story 3

- [X] T014 [P] [US3] Env-resolver tests: substitution, nested/array walking, missing-var
      error, strict vs non-strict in [tests/unit/env-resolver.test.ts](tests/unit/env-resolver.test.ts). *(commit d5c2976)*

### Implementation for User Story 3

- [X] T015 [US3] Implement `${VAR}` deep resolution in `src/utils/env.ts` (collect all
      misses, single error). *(commit d5c2976)*
- [X] T016 [US3] Wire env resolution into the loader: strict for global config and enabled
      backends, lenient for disabled backends, in [src/config/loader.ts](src/config/loader.ts). *(commit d5c2976)*
- [X] T017 [US3] Full env parametrization for Docker and single `./data` folder. *(commit ac01f5e)*

**Checkpoint**: Secrets stay out of files; missing required vars fail loudly.

---

## Phase 6: User Story 4 - Clear errors for invalid configuration (Priority: P2)

**Goal**: One readable message listing every problem and its field path.

**Independent Test**: Load a file with multiple mistakes and confirm one message enumerates
each with its location.

### Tests for User Story 4

- [X] T018 [US4] Invalid-JSON and invalid-shape cases asserted in
      [tests/unit/config-loader.test.ts](tests/unit/config-loader.test.ts). *(commit d5c2976)*

### Implementation for User Story 4

- [X] T019 [US4] Implement `formatZodError` (per-issue path + message) and JSON-parse
      error wrapping in [src/config/loader.ts](src/config/loader.ts). *(commit d5c2976)*

**Checkpoint**: All user stories independently functional.

---

## Phase 7: User Story 5 - Single data directory and env/flag path overrides (Priority: P2)

**Goal**: Root all persisted paths under one directory (default `./data`, override via
`MORPH_DATA_DIR`), resolve config/backend file locations with flag/env precedence, and derive
the backend file as the suffix-preserving sibling of the gateway file.

**Independent Test**: Set `MORPH_DATA_DIR`, start with no config flags, confirm DB, logs, and
config all resolve under that directory.

### Tests for User Story 5

- [X] T023 [US5] Path-resolution tests: data-dir default + override, config precedence
      (`${dataDir}/morph.json` → `./morph.json`), `.mcp.json` sibling derivation, explicit
      overrides, in [tests/unit/paths.test.ts](tests/unit/paths.test.ts). *(commit ac01f5e)*

### Implementation for User Story 5

- [X] T024 [US5] Implement `resolvePaths` / `resolveMcpConfigPath` (`dataDir`, `configPath`,
      `mcpPath`, `logDir` with `MORPH_DATA_DIR`/`MORPH_CONFIG`/`MORPH_MCP_CONFIG`/`MORPH_LOG_DIR`
      overrides) in [src/config/paths.ts](src/config/paths.ts). *(commit ac01f5e)*
- [X] T025 [US5] Wire resolved paths into bootstrap ([src/index.ts](src/index.ts)) and the
      SQLite/OAuth/log stores so a single volume mount persists everything. *(commit ac01f5e)*

**Checkpoint**: One data dir + overrides; container needs a single volume mount.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T020 [P] Keep generated `schema.json` / `mcp.schema.json` in sync via
      `npm run gen:schema` (never hand-edited). *(Constitution Principle I)*
- [X] T021 [P] SPEC/IMPL header tags on all config files (Principle II).
- [X] T022 Confirm stderr-only logging and explicit `.js` ESM imports across the config
      layer (Principle IV).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories (schema + types).
- **User Stories (Phase 3+)**: All depend on the zod contract from Phase 2. US1 and US2 are
  both P1; US2's watcher reuses the US1 loader. US3 and US4 layer onto the loader.
- **User Story 5 (Phase 7)**: Depends on the loader/types; independent of US2–US4.
- **Polish (Phase 8)**: Depends on all stories.

### Within Each User Story

- Contract (schema/types) → failing test → implementation.
- Schema before loader; loader before watcher.

### Parallel Opportunities

- T002 / T003 in Setup.
- T007 (loader tests) and T014 (env tests) target different files and can run in parallel.
- T020 / T021 polish tasks.

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 Setup → Phase 2 Foundational (zod contract).
2. Phase 3 US1 → working two-file load with defaults and duplicate rejection.
3. Validate independently, then layer on hot-reload (US2), env placeholders (US3), and error
   formatting (US4).

---

## Notes

- The zod schema is the single source of truth; JSON Schemas and TS types are derived.
- All tasks reflect already-merged work (commits d5c2976, 5be6fb9, 73404fe, ac01f5e).
- `config-loader.test.ts` has ~7 tests; `env-resolver.test.ts` has ~5; `paths.test.ts`
  covers the single-data-dir resolution (US5).
