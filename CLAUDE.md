<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->

# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## What MORPH is

MORPH (MCP Optimized Response Protocol Handler) is a **gateway proxy** between AI agents and
backend MCP servers. Agents connect to MORPH as a single MCP server; MORPH aggregates the
tools of all configured backends and converts every JSON tool result into TOON to cut token
usage 30–60%. Backends are reached over stdio, HTTP, or SSE (with optional OAuth). See
[PLAN.md](PLAN.md) for the architecture overview and [docs/](docs/) for the full docs.

## Commands (everything runs in Docker; Node >=22, ESM)

```bash
docker run --rm -v "$PWD":/app -w /app node:22 sh -c "npm install && npm test"
docker run --rm -v "$PWD":/app -w /app node:22 sh -c "npm install && npm run typecheck"
docker run --rm -v "$PWD":/app -w /app node:22 sh -c "npm install && npm run build"
# Regenerate schema.json + mcp.schema.json after editing src/config/schema.ts:
docker run --rm -v "$PWD":/app -w /app node:22 sh -c "npm install && npm run gen:schema"
```

## Development workflow (SDD)

This repo follows **Specification-Driven Development**: write the contract first
(`src/config/schema.ts` zod schema → `src/config/types.ts` inferred types), then a failing
test, then the implementation. Source files are tagged with `SPEC:` (contracts) and `IMPL:`
(implementations) header comments — preserve that distinction. The zod schema is the
executable source of truth; `schema.json`/`mcp.schema.json` are **generated** — never
hand-edit them, run `gen:schema`.

### Spec Kit (governance layer)

On top of the SDD-Zod loop, MORPH uses **[GitHub Spec Kit](https://github.com/github/spec-kit)**
to give each feature a versioned specification. The project principles are codified in
[.specify/memory/constitution.md](.specify/memory/constitution.md) (Principles I–V:
zod-first, SPEC/IMPL, test-first, Docker/ESM, token savings). For **new features**, drive
the flow with the installed skills:

```
/speckit-constitution → /speckit-specify → /speckit-plan → /speckit-tasks → /speckit-implement
```

Each feature lives in `specs/NNN-feature/` with `spec.md` (what/why), `plan.md` (how,
including a Constitution Check gate), `tasks.md`, and — when configuration is involved — a
`data-model.md` derived from `src/config/schema.ts`. The Spec Kit sits *above* the zod
contract: the spec describes the feature, the zod schema remains the executable contract it
references. The v2.0 features are documented retroactively in [specs/](specs/) (`001`–`010`).
