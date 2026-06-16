# Implementation Plan: Configuration System

**Branch**: `005-config-system` | **Date**: 2026-06-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/005-config-system/spec.md`

**Note**: Retroactive plan — the configuration system is already implemented. This document
records the design and its compliance with the constitution.

## Summary

MORPH reads its configuration from two human-editable JSON files: `morph.json` for gateway
behavior (validated by `schema.json`) and `.mcp.json` for the backend MCP server inventory
(a Claude-style keyed object validated by `mcp.schema.json`). Both files are hot-reloadable
via a chokidar watcher, and `${ENV}` placeholders in their values are resolved against
`process.env` at load time. The structure is defined once as a zod schema in
[src/config/schema.ts](src/config/schema.ts) — the single source of truth — from which the
TypeScript types are inferred (`z.infer`) and the editor-facing JSON Schemas are generated
via `npm run gen:schema`. Loading validates against the zod schema and reports all issues in
one readable error; the watcher only emits validated configs, so a bad live edit leaves the
last known-good configuration in place.

## Technical Context

**Language/Version**: TypeScript (ESM, `NodeNext`) on Node 22

**Primary Dependencies**: `zod` (executable contract + validation), `chokidar` (file
watching), `zod-to-json-schema` (JSON Schema generation)

**Storage**: Two JSON files on the filesystem — `morph.json` and `.mcp.json`

**Testing**: Vitest — `tests/unit/config-loader.test.ts`, `tests/unit/env-resolver.test.ts`

**Target Platform**: Linux server, runs in a `node:22` Docker container

**Project Type**: Single project (gateway service)

**Performance Goals**: Live reload applied within ~1s of a file settling; rapid writes
debounced to a single reload

**Constraints**: Pure ESM with explicit `.js` import extensions; logs to stderr (stdout is
reserved for the stdio MCP protocol); no hand-editing of generated JSON Schemas

**Scale/Scope**: Tens of backend servers per gateway; two config files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Confirm the plan complies with the MORPH Constitution (`.specify/memory/constitution.md`):

- [x] **I. Contract-First (Zod)**: The zod schema in [src/config/schema.ts](src/config/schema.ts)
      is the executable contract and single source of truth. Types in
      [src/config/types.ts](src/config/types.ts) are produced by `z.infer` — never
      hand-written. `schema.json` (and `mcp.schema.json`) are regenerated with
      `npm run gen:schema` and never hand-edited. Validation at load (`MorphConfigSchema`)
      uses the same schema, so the contract is enforced at runtime as well as compile time.
- [x] **II. SPEC vs IMPL**: `schema.ts` and `types.ts` carry `SPEC:` headers (contracts);
      `loader.ts` and `watcher.ts` carry `IMPL:` headers and depend on those contracts.
- [x] **III. Test-First / one test per module**: the loader and env resolver each have a
      sibling unit test (`tests/unit/config-loader.test.ts`,
      `tests/unit/env-resolver.test.ts`).
- [x] **IV. Docker-First / Pure ESM**: all steps run under `node:22`; intra-package imports
      use `.js` extensions from `.ts` files; the config layer emits no stdout.
- [x] **V. Token Savings**: configuration exposes `toon.autoConvert` and `toon.threshold`,
      which gate TOON conversion; this feature feeds the converter and introduces no
      regression to token savings.

No violations — Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/005-config-system/
├── plan.md              # This file
├── spec.md              # Feature specification (what/why)
├── data-model.md        # zod-derived entity model (gateway settings, MCP server entry, TOON options) — generated separately
└── tasks.md             # Task list
```

> `data-model.md` is a human-readable view derived from the zod schema in
> [src/config/schema.ts](src/config/schema.ts); the schema remains the source of truth.
> No `contracts/` directory: the zod schema *is* the contract.

### Source Code (repository root)

```text
src/config/
├── schema.ts            # SPEC: executable zod schema (single source of truth)
├── types.ts             # SPEC: TypeScript types via z.infer
├── loader.ts            # IMPL: read + ${ENV} resolution + zod validation
└── watcher.ts           # IMPL: chokidar watch, debounced, emits validated configs

src/utils/
└── env.ts               # IMPL: ${VAR} placeholder resolution

scripts/
└── gen-schema.ts        # generates schema.json / mcp.schema.json from the zod schema

tests/unit/
├── config-loader.test.ts
└── env-resolver.test.ts

# generated artifacts (do not hand-edit)
schema.json
mcp.schema.json
```

**Structure Decision**: Single project. The configuration layer lives under
[src/config/](src/config), split SPEC/IMPL: contracts in
[src/config/schema.ts](src/config/schema.ts) and [src/config/types.ts](src/config/types.ts),
implementations in [src/config/loader.ts](src/config/loader.ts) and
[src/config/watcher.ts](src/config/watcher.ts), with `${ENV}` resolution factored into
`src/utils/env.ts`. The Hub (`src/hub.ts`) consumes the watcher's validated configs and owns
diff/apply.

### Implementation history (cited commits)

- **d5c2976** — config loader, zod schema, env resolution and utils (the foundation:
  `schema.ts`, `types.ts`, `loader.ts`, env resolver).
- **5be6fb9** — split configuration into `morph.json` (gateway, `schema.json`) and
  `.mcp.json` (backends, Claude-style keyed object, `mcp.schema.json`).
- **73404fe** — `toolPrefix`: template-based prefix applied to all exposed tool names.
- **ac01f5e** — full env parametrization (Docker) and single `./data` folder.

## Complexity Tracking

> No constitution violations — table intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| —         | —          | —                                    |
