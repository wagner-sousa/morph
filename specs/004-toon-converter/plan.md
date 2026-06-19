# Implementation Plan: TOON Converter

**Branch**: `004-toon-converter` | **Date**: 2026-06-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-toon-converter/spec.md`

## Summary

MORPH converts JSON tool results into TOON to cut agent token usage 30–60%. The converter
(`src/toon/converter.ts`) wraps the `@toon-format/toon` encoder and is invoked by the Hub
on every MCP tool result. Eligible content (text that parses as JSON) is encoded to TOON,
kept only when strictly smaller than the source, and annotated with per-item savings
metadata; an optimizer library (`src/toon/optimizer.ts`) and savings estimator
(`src/toon/stats.ts`) support the heuristics and reporting. After initial routing-gated
conversion (df03fe5) and optimizer hardening (c76f279), the design evolved to **force**
conversion on all results, bypassing the `toon.autoConvert` gate and the per-payload
`decideConvert` heuristic for consistent behavior across every tool call (2ca0efe).

## Technical Context

**Language/Version**: TypeScript (NodeNext, pure ESM) on Node 22

**Primary Dependencies**: `@toon-format/toon` (ESM-only encoder/decoder)

**Storage**: SQLite savings history (token-savings tracking); N/A to the converter core

**Testing**: Vitest — `tests/unit/toon-converter.test.ts`, `tests/unit/optimizer.test.ts`

**Target Platform**: Linux server / `node:22` Docker container

**Project Type**: Single project — MCP gateway proxy service

**Performance Goals**: 30–60% token reduction on uniform arrays; never enlarge a payload

**Constraints**: Conversion must never break a real response; logs to stderr; intra-package
imports use explicit `.js` extensions

**Scale/Scope**: Applies to 100% of tool results (backend + built-in `_morph_*` tools)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Contract-First (Zod)**: TOON options live in `src/config/schema.ts`
      (`toon.indent`, `delimiter`, `flattenDepth`, `threshold`, `autoConvert`); the
      converter consumes `ToonOptions` derived via `z.infer` in `src/config/types.ts`. No
      generated schema hand-edited.
- [x] **II. SPEC vs IMPL**: `converter.ts`, `optimizer.ts`, `stats.ts` all carry `IMPL:`
      headers; the `ToonOptions` contract precedes them.
- [x] **III. Test-First / one test per module**: each module has a sibling unit test —
      `toon-converter.test.ts` and `optimizer.test.ts`.
- [x] **IV. Docker-First / Pure ESM**: builds/tests run in `node:22`; `@toon-format/toon`
      is ESM-only and consumed via ESM imports with `.js` extensions; no stdout logging.
- [x] **V. Token Savings**: this *is* the token-savings feature; results flow through the
      converter, savings are estimated (`stats.ts`) and recorded in SQLite history.

No violations — Complexity Tracking omitted.

## Project Structure

### Documentation (this feature)

```text
specs/004-toon-converter/
├── plan.md      # This file
├── spec.md      # Feature spec (Implemented)
└── tasks.md     # Task breakdown
```

No `data-model.md` or `contracts/` — this feature adds no configuration entities of its
own beyond the existing `toon` block in the config schema.

### Source Code (repository root)

```text
src/
├── toon/
│   ├── converter.ts    # IMPL: wraps @toon-format/toon, converts tool results
│   ├── optimizer.ts    # IMPL: uniform-array / depth / threshold heuristics
│   └── stats.ts        # IMPL: ~4 chars/token savings estimation
├── hub.ts              # coordinator — invokes converter on every tool result
└── config/
    ├── schema.ts       # zod `toon` options contract
    └── types.ts        # ToonOptions via z.infer

tests/
└── unit/
    ├── toon-converter.test.ts   # ~4 tests
    └── optimizer.test.ts        # ~16 tests
```

Real files:
[src/toon/converter.ts](../../src/toon/converter.ts),
[src/toon/optimizer.ts](../../src/toon/optimizer.ts),
[src/toon/stats.ts](../../src/toon/stats.ts),
[src/hub.ts](../../src/hub.ts).

**Structure Decision**: Single-project layout. The converter is a self-contained module
under `src/toon/` and is wired through the Hub (`src/hub.ts`), which calls
`converter.convertResult()` for backend tool results, built-in tool results, and the
built-in conversion path — keeping the Hub the sole coordinator per the constitution.

### Key implementation references

- **df03fe5** — `feat(router,toon)`: initial tool routing with conflict resolution plus
  the first TOON converter, optimizer, and stats modules.
- **c76f279** — `feat`: enhanced optimizer with uniform-array detection and max-depth
  checks (`isUniformArray`, `maxDepth`, refined `decideConvert`).
- **2ca0efe** — `feat(toon)`: force TOON on all MCP tool results — removed the
  `toon.autoConvert` branch in `src/hub.ts` and the `decideConvert` gate inside
  `convertResult`, leaving only the structural JSON check and the size guard.
