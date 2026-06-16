# Implementation Plan: Demo & Test MCP Servers

**Branch**: `009-demo-servers` | **Date**: 2026-06-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/009-demo-servers/spec.md`

## Summary

Provide five self-contained demo MCP servers — one per supported transport/feature
(stdio, streamable HTTP, SSE, HTTP+OAuth, stdio+parameters) — plus a minimal test fixture
server, so MORPH can be run and tested end-to-end with zero external dependencies. The
servers exercise tool aggregation, every transport path, OAuth/apiKey auth, and TOON-ideal
uniform arrays. They run via `tsx` from source in the dev stack and tests and are not part
of the gateway runtime.

## Technical Context

**Language/Version**: TypeScript (ESM, `NodeNext`) on Node 22

**Primary Dependencies**: `@modelcontextprotocol/sdk` (server transports: stdio,
streamableHttp, sse), Node `http` (no extra HTTP framework)

**Storage**: N/A (parameterized server uses local filesystem under `--base-path`)

**Testing**: Vitest — `tests/unit/demo-servers.test.ts` (startup + tool calls),
`tests/integration/tool-routing.test.ts` (real MCP round-trips)

**Target Platform**: Linux container (`node:22`); HTTP/SSE/OAuth on dev-stack ports
3200 (HTTP), 3201 (SSE), 3202 (OAuth)

**Project Type**: Single project — supporting dev/test servers under `src/examples/`

**Performance Goals**: N/A (deterministic local backends; latency simulated via `delay`)

**Constraints**: Fully offline; SDK-only dependency; logs to stderr; run via `tsx` (no
`dist/` requirement); not loaded by the gateway runtime

**Scale/Scope**: 5 demo servers + 1 test fixture; ~3–4 tools each

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Contract-First (Zod)**: No configuration-schema change. The demo config
      (`morph.demo.json`) consumes the existing `.mcp.json` contract — no edits to
      `src/config/schema.ts` or generated JSON Schemas.
- [x] **II. SPEC vs IMPL**: Demo/test servers are pure `IMPL` artifacts; they implement no
      new contract and live outside `src/` runtime modules under `src/examples/` and
      `tests/fixtures/`.
- [x] **III. Test-First / one test per module**: Behavior is covered by
      `tests/unit/demo-servers.test.ts` and exercised by
      `tests/integration/tool-routing.test.ts` via real round-trips.
- [x] **IV. Docker-First / Pure ESM**: Servers are pure ESM with `.js` import specifiers,
      run via `tsx` inside `node:22`, and emit all logs to **stderr** (critical for the
      stdio servers so stdout stays protocol-clean).
- [x] **V. Token Savings**: No converter change. The `users`/`large_json` tools return
      uniform arrays specifically to demonstrate and validate TOON conversion through the
      gateway; results still flow through MORPH's converter unchanged.

All boxes pass — no Complexity Tracking entries required.

## Project Structure

### Documentation (this feature)

```text
specs/009-demo-servers/
├── plan.md      # This file
├── spec.md      # Feature specification
└── tasks.md     # Task breakdown
```

No `data-model.md` or `contracts/` — this feature introduces no configuration contract.

### Source Code (repository root)

```text
src/examples/
├── demo-mcp-server.ts    # stdio transport (ping/users/echo)
├── http-mcp-server.ts    # streamable HTTP transport, port 3200
├── sse-mcp-server.ts     # SSE transport, port 3201
├── oauth-mcp-server.ts   # HTTP + OAuth (metadata/register/authorize/token), port 3202
└── param-mcp-server.ts   # stdio + launch params (--base-path, DEMO_MODE)

tests/fixtures/
├── test-mcp-server.ts    # echo/fail/delay/large_json fixture
└── morph.test.json       # test config

tests/unit/demo-servers.test.ts        # startup + tool-call coverage (~8 tests)
tests/integration/tool-routing.test.ts # real MCP round-trips (~5 tests)

morph.demo.json           # demo config wiring all five servers as backends
```

**Structure Decision**: Single project. Each transport/feature is implemented as one
self-contained server file under [src/examples/](../../src/examples), kept separate from
the gateway runtime (`src/hub.ts` and friends). The test fixture lives under
[tests/fixtures/test-mcp-server.ts](../../tests/fixtures/test-mcp-server.ts). Five distinct
files (rather than one parameterized server) keep each transport's wiring explicit and
independently runnable.

### Key Design Decision

Five self-contained demo servers exercise all transport types plus auth and parameter
features end-to-end with no external dependencies. The OAuth demo includes full
authorization-server metadata, dynamic client registration, and authorize/token endpoints,
and accepts `demo-token` as the bearer/apiKey credential. All servers run via `tsx`
directly from source (not compiled `dist/`) in the dev stack and tests, and are
deliberately excluded from the gateway runtime itself.

### Implementation History (cited commits)

- `94e3f58` — add test MCP servers for all 3 transport types (stdio/http/sse)
- `bf0ae4a` — add oauth-mcp-server, param-mcp-server, and demo `morph.json` with 5 MCPs
- `371deb5` — cleanup; improve demo HTTP server
- `217ceef` — offline demo; stream backend stderr
- `ac5d7f7` — use `tsx` instead of compiled `dist/` for demo servers

## Complexity Tracking

> No Constitution Check violations — table intentionally empty.
