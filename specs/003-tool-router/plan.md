# Implementation Plan: Tool Router

**Branch**: `003-tool-router` | **Date**: 2026-06-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-tool-router/spec.md`

**Note**: Retroactive plan — the feature is already implemented in `src/router/`.

## Summary

The Router aggregates the tools of every backend MCP server into a single agent-facing
tool list and resolves the exposed-name → (backend, original tool) mapping. Name conflicts
are resolved by a fixed, deterministic order: explicit per-backend `aliases` → global
`toolPrefix` template → auto-prefix conflicts as `${mcp}_${tool}` → `allowConflicts`
last-wins (logged). Routes are rebuilt from scratch on every config reload. The routing
contract lives in `src/router/types.ts` (SPEC); the resolution logic lives in
`src/router/index.ts` (IMPL).

## Technical Context

**Language/Version**: TypeScript (ESM, `NodeNext`) on Node 22

**Primary Dependencies**: none beyond the project's internal logger and MCP client types; pure in-memory `Map` routing

**Storage**: N/A (in-memory route table, rebuilt on reload)

**Testing**: Vitest — `tests/unit/router.test.ts`

**Target Platform**: Linux server / `node:22` Docker container

**Project Type**: Single project (gateway service)

**Performance Goals**: Route resolution is O(1) `Map` lookup; route building is linear in total tool count

**Constraints**: Deterministic exposed names across builds; logs to stderr only; no stdout corruption of the stdio MCP protocol

**Scale/Scope**: Tens of backends, hundreds of aggregated tools

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Confirm the plan complies with the MORPH Constitution (`.specify/memory/constitution.md`):

- [x] **I. Contract-First (Zod)**: This feature adds no configuration fields of its own —
      `aliases`, `toolPrefix`, and `allowConflicts` already exist in `src/config/schema.ts`
      and are consumed as inputs. No `schema.json` hand-editing. Compliant.
- [x] **II. SPEC vs IMPL**: `src/router/types.ts` carries `SPEC:` (the routing contract) and
      `src/router/index.ts` carries `IMPL:`. The contract precedes and is satisfied by the
      implementation. Compliant.
- [x] **III. Test-First / one test per module**: `tests/unit/router.test.ts` is the single
      sibling test for the module and covers all four conflict steps plus prefix templates.
      Compliant.
- [x] **IV. Docker-First / Pure ESM**: intra-package imports use `.js` extensions from `.ts`;
      runs under `node:22`; the logger writes to stderr. Compliant.
- [x] **V. Token Savings**: routing is name-resolution only and does not touch the TOON
      converter; all routed results still flow through the downstream converter unchanged. No
      regression. Compliant.

All boxes pass — no Complexity Tracking entries required.

## Project Structure

### Documentation (this feature)

```text
specs/003-tool-router/
├── plan.md   # This file
├── spec.md   # Feature specification (what/why)
└── tasks.md  # Task list
```

No `contracts/` or `data-model.md`: the SPEC contract is the interface set in
`src/router/types.ts`, and this feature adds no new configuration shape.

### Source Code (repository root)

```text
src/router/
├── types.ts   # SPEC: RouteEntry, ResolvedRoute, RouterInput
└── index.ts   # IMPL: Router (buildRoutes, resolve, has, getAllTools, getRouteTable)

tests/unit/
└── router.test.ts   # Vitest unit suite
```

- Contract: [src/router/types.ts](../../src/router/types.ts)
- Implementation: [src/router/index.ts](../../src/router/index.ts)
- Tests: [tests/unit/router.test.ts](../../tests/unit/router.test.ts)

**Structure Decision**: Single-project layout. The router is a self-contained module wired
into the gateway via the Hub (`src/hub.ts`); it depends only on the logger and MCP client
tool types, keeping conflict resolution isolated and unit-testable.

### Implementation history (cited commits)

- **df03fe5** — tool routing with conflict resolution + TOON: established the Router, the
  alias → auto-prefix → allowConflicts order, and integration with TOON-converted results.
- **73404fe** — toolPrefix template-based prefix: added the global `{name}`-token prefix
  template, inserted as step 2 of the order (taking precedence over auto-prefix and
  last-wins).

## Complexity Tracking

> No violations — table intentionally empty.
