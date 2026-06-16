# Implementation Plan: Built-in MORPH Tools

**Branch**: `008-builtin-tools` | **Date**: 2026-06-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/008-builtin-tools/spec.md`

## Summary

Expose MORPH's own gateway operations to the agent as ordinary MCP tools. Three
built-ins — `_morph_status`, `_morph_toon_stats`, `_morph_reload_config` — are appended
to the unified `tools/list` next to backend tools. The agent-facing MCP server delegates
all calls to the Hub; the Hub detects the reserved `_morph_` names *before* routing and
handles them directly (no backend round-trip), then runs the result through the TOON
converter so built-in output is formatted exactly like backend output. The same behavior
is reachable over the SDK stdio server, a direct JSON-RPC handler (HTTP/SSE), and a
per-MCP direct handler.

## Technical Context

**Language/Version**: TypeScript 5.x on Node 22 (`node:22`), pure ESM (`NodeNext`)

**Primary Dependencies**: `@modelcontextprotocol/sdk` (Server, Stdio transport, request
schemas), MORPH Hub / tool router / TOON converter / metrics / SQLite store

**Storage**: In-memory metrics tally (`src/metrics.ts`) + SQLite call/log history; no new
storage for this feature

**Testing**: Vitest — `tests/unit/hub.test.ts` (built-in dispatch + TOON conversion),
`tests/unit/mcp-handler.test.ts` (JSON-RPC handler)

**Target Platform**: Linux container (Docker `node:22`); stdio + HTTP/SSE transports

**Project Type**: Single project (MCP gateway service)

**Performance Goals**: Built-in calls resolve with zero backend round-trips; status/stats
served from in-memory state

**Constraints**: Logs to stderr only (stdout reserved for stdio MCP protocol); built-in
results must not regress TOON formatting consistency

**Scale/Scope**: 3 built-in tools, 1 unified tool list, 3 transport handlers

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Contract-First (Zod)**: No configuration shape changes — built-ins are static
      `Tool` descriptors, not config. `src/config/schema.ts` and generated schemas are
      untouched. Pass.
- [x] **II. SPEC vs IMPL**: `builtin-tools.ts` carries a `SPEC:` header (tool contracts);
      `server.ts` and the Hub dispatch carry `IMPL:` headers. Contracts precede impl.
      Pass.
- [x] **III. Test-First / one test per module**: Built-in dispatch + TOON conversion is
      covered by `tests/unit/hub.test.ts`; the JSON-RPC handler by
      `tests/unit/mcp-handler.test.ts`. Pass.
- [x] **IV. Docker-First / Pure ESM**: All imports use explicit `.js` extensions; runs
      under `node:22`; logger output goes to stderr (never corrupts stdio protocol).
      Pass.
- [x] **V. Token Savings**: Built-in results are passed through `converter.convertResult`
      in the Hub before return, so the `_morph_*` tools honor the same TOON conversion as
      backend tools — no regression and consistent output. Pass.

All boxes checked — no entries required in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/008-builtin-tools/
├── plan.md              # This file
├── spec.md              # Feature specification
├── tasks.md             # Task breakdown
└── contracts/
    └── builtin-tools.md # The three built-in tool contracts
```

(No `data-model.md`: this feature does not touch the zod config contract.)

### Source Code (repository root)

```text
src/
├── mcp-server/
│   ├── builtin-tools.ts   # SPEC: built-in Tool descriptors + name set + isBuiltinTool()
│   └── server.ts          # IMPL: agent-facing MCP server; SDK + direct JSON-RPC handlers
└── hub.ts                 # IMPL: getAllTools() unifies list; executeCall() dispatches
                           #       built-ins, callBuiltin() + getStatus() implement them

tests/
└── unit/
    ├── hub.test.ts        # built-in dispatch + TOON conversion of built-in results
    └── mcp-handler.test.ts# direct JSON-RPC handler (initialize/tools/list/tools/call)
```

**Structure Decision**: Single-project layout. The agent-facing surface lives in
[src/mcp-server/server.ts](../../src/mcp-server/server.ts) and the built-in contracts in
[src/mcp-server/builtin-tools.ts](../../src/mcp-server/builtin-tools.ts); coordination,
the unified tool list, and built-in execution live in the Hub
([src/hub.ts](../../src/hub.ts)), per the constitution's "Hub is the coordinator" rule.

### Implementation history (commits)

- **b1c6515** — Hub + agent-facing MCP server: unified `getAllTools()` (backend +
  built-ins), built-in dispatch before routing, TOON conversion of built-in results.
- **f276196** — Direct JSON-RPC handler over HTTP/SSE (`createDirectHandler`):
  `initialize` / `tools/list` / `tools/call`, with built-ins exposed identically.
- **e2a6d65** — Per-MCP direct handler (`createPerMcpDirectHandler`) scoping a JSON-RPC
  endpoint to a single backend MCP's tools.

## Complexity Tracking

> No constitution violations — table intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| —         | —          | —                                    |
