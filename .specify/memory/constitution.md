# MORPH Constitution

MORPH (MCP Optimized Response Protocol Handler) is a gateway proxy that sits between AI
agents and backend MCP servers, aggregating their tools and converting JSON tool results
into TOON to cut token usage. This constitution encodes the non-negotiable engineering
principles already practiced in the codebase so that every Spec Kit artifact
(`spec.md` → `plan.md` → `tasks.md`) stays aligned with how MORPH is actually built.

## Core Principles

### I. Contract-First via Zod (NON-NEGOTIABLE)

The executable contract is the zod schema in `src/config/schema.ts` — it is the single
source of truth for configuration structure. Any change to configuration MUST:

1. Edit `src/config/schema.ts` first.
2. Derive TypeScript types via `z.infer` in `src/config/types.ts` — never hand-write them.
3. Regenerate the JSON Schemas with `npm run gen:schema`.

`schema.json` and `mcp.schema.json` are **generated artifacts** — they MUST NOT be edited
by hand. A `data-model.md` in a spec is a human-readable *view* of the zod contract, never
a competing source of truth.

### II. SPEC vs IMPL Separation

Every source file is tagged in its header comment with either `SPEC:` (contracts:
schemas, types, interfaces) or `IMPL:` (implementations). This distinction MUST be
preserved. Contracts (`types.ts`, `schema.ts`, interface files) are written and reviewed
before the implementations that satisfy them.

### III. Test-First, One Test Per Module (NON-NEGOTIABLE)

Write the contract, then a failing test, then the implementation
(`types/schema → *.test.ts → *.ts`). There is generally one `*.test.ts` file per source
module under `tests/unit/`; when a module is added or changed, its sibling test MUST be
updated in the same change. Integration behavior (real MCP round-trips) lives in
`tests/integration/`.

### IV. Docker-First, Pure ESM

No local Node toolchain is assumed — every build/test/codegen step MUST be runnable in a
clean container (`node:22`). The project is pure ESM (`"type": "module"`, TS `NodeNext`):
intra-package imports use explicit `.js` extensions even from `.ts` files. Logger output
goes to **stderr** so it never corrupts the stdio MCP protocol on stdout.

### V. Token Savings as the Product Goal

MORPH exists to reduce agent token usage via TOON conversion (target: 30–60% savings).
Features MUST NOT regress this goal: TOON conversion is gated by `toon.threshold` and
`toon.autoConvert`, and every tool result — including built-in `_morph_*` tools — passes
through the converter for consistent output. Token-savings outcomes are tracked and
measurable (see `src/toon/stats.ts`, SQLite savings history).

## Additional Constraints

- **Two config files**: `morph.json` (gateway behavior, schema `schema.json`) and
  `.mcp.json` (backend servers, Claude-style, schema `mcp.schema.json`). Both are
  hot-reloadable and `${ENV}` placeholders are resolved at load.
- **Conflict resolution order** for tool names is fixed: explicit `aliases` → global
  `toolPrefix` → auto-prefix as `${mcp}_${tool}` → `allowConflicts` last-wins (logged).
- **The Hub is the coordinator**: `src/hub.ts` owns and wires every component; new runtime
  components are wired through it, not bolted on independently.

## Development Workflow

New features follow the Spec Kit flow on top of the SDD-Zod loop:

```
/speckit-constitution → /speckit-specify → /speckit-plan → /speckit-tasks → /speckit-implement
```

Each feature gets a `specs/NNN-feature/` directory with `spec.md` (what/why),
`plan.md` (how, incl. a Constitution Check), and `tasks.md`. Specs that touch
configuration MUST include a `data-model.md` derived from `src/config/schema.ts`. Every
`plan.md` MUST pass the Constitution Check (Principles I–V) before implementation begins.

## Governance

This constitution supersedes ad-hoc practice. Amendments require updating this file and
the dependent templates in `.specify/templates/`. The Constitution Check in `plan.md` is a
hard gate: a violation must be either removed or justified in that plan's Complexity
Tracking table. Compliance is verified by the existing CI pipeline
(typecheck → test → build) — a change that breaks zod-first, SPEC/IMPL, or the Docker/ESM
constraints is non-compliant regardless of review approval.

**Version**: 1.0.0 | **Ratified**: 2026-06-16 | **Last Amended**: 2026-06-16
