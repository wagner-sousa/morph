# Implementation Plan: MCP Client Transports & Registry

**Branch**: `001-mcp-client-transports` | **Date**: 2026-06-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-mcp-client-transports/spec.md`

**Note**: This plan documents an already-implemented feature retroactively.

## Summary

MORPH connects to backend MCP servers over three transports — stdio (local child
process), Streamable HTTP, and SSE (legacy) — behind a single `MCPClient`
contract, and manages all those connections through a central
`MCPClientRegistry`. A shared abstract base implements the common lifecycle
(connect with bounded retry, disconnect, list/call tools, status, lifecycle
events); each transport subclass only builds its concrete SDK transport object. A
factory maps a config definition's transport type to the right client class. The
registry owns clients plus their definitions and cached tools, isolates per-
backend failures during startup, supports runtime add/remove/update/reconnect for
hot-reload, skips disabled backends (without requiring their credentials), and
exposes a status summary. OAuth hooks for HTTP backends are surfaced here but the
OAuth flow itself is defined in spec 002.

## Technical Context

**Language/Version**: TypeScript on Node.js >= 22, pure ESM (`"type": "module"`,
`NodeNext` module resolution; intra-package imports use `.js` extensions).

**Primary Dependencies**: `@modelcontextprotocol/sdk` (Client, Stdio/Streamable
HTTP/SSE client transports, OAuth `auth` + `OAuthClientProvider`), Node built-in
`EventEmitter`, internal logger and `retry` utility.

**Storage**: N/A for this feature (OAuth token storage is covered in spec 002).

**Testing**: Vitest — `tests/unit/mcp-connection.test.ts` covers registry
lifecycle (~6 tests).

**Target Platform**: Linux server, runnable in a clean `node:22` container.

**Project Type**: Single project (gateway service) — `src/` + `tests/`.

**Performance Goals**: Backends connect concurrently at startup; tool discovery
is cached per client so router/health reads are cheap; ping latency recorded on
refresh.

**Constraints**: One failing backend MUST NOT abort startup; stdio backend stderr
streamed (`stderr: 'inherit'`); logger output to stderr to keep stdout clean for
the stdio MCP protocol; bounded connect retries (default 3).

**Scale/Scope**: Tens of backend MCP servers per gateway instance, each exposing
many tools.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Confirm the plan complies with the MORPH Constitution (`.specify/memory/constitution.md`):

- [X] **I. Contract-First (Zod)**: This feature consumes config types
      (`StdioTransport`/`HttpTransport`/`SseTransport`/`MCPDefinition`) derived
      from the zod schema via `z.infer`; it adds no hand-edited schema artifacts.
- [X] **II. SPEC vs IMPL**: The SPEC contract is
      [src/mcp-client/types.ts](src/mcp-client/types.ts) (`MCPClient`,
      `ClientOptions`, status/event types); all transport/registry files carry
      `IMPL:` headers and satisfy that contract.
- [X] **III. Test-First / one test per module**: Registry lifecycle behavior is
      exercised by [tests/unit/mcp-connection.test.ts](tests/unit/mcp-connection.test.ts)
      (~6 tests).
- [X] **IV. Docker-First / Pure ESM**: All imports use explicit `.js` extensions;
      builds/tests run in `node:22`; logs and stdio backend stderr go to stderr,
      never stdout.
- [X] **V. Token Savings**: This connection layer is upstream of TOON conversion;
      it returns raw `CallToolResult`s unchanged so the converter still gates and
      processes every result — no regression to token savings.

Any unchecked box must be justified in the Complexity Tracking table below.

## Project Structure

### Documentation (this feature)

```text
specs/001-mcp-client-transports/
├── plan.md      # This file
├── spec.md      # Feature specification
└── tasks.md     # Task backlog (all complete)
```

### Source Code (repository root)

```text
src/mcp-client/
├── types.ts         # SPEC: the MCPClient contract all transports satisfy
├── base-client.ts   # IMPL: shared lifecycle, retry, list/call tools, events
├── stdio-client.ts  # IMPL: stdio transport (spawns child process)
├── http-client.ts   # IMPL: Streamable HTTP transport (+ OAuth hooks)
├── sse-client.ts    # IMPL: legacy SSE transport
├── factory.ts       # IMPL: transport-type → client class
└── registry.ts      # IMPL: lifecycle management for all backend clients

tests/
└── unit/
    └── mcp-connection.test.ts  # registry lifecycle (~6 tests)
```

Real files:

- [src/mcp-client/types.ts](src/mcp-client/types.ts)
- [src/mcp-client/base-client.ts](src/mcp-client/base-client.ts)
- [src/mcp-client/stdio-client.ts](src/mcp-client/stdio-client.ts)
- [src/mcp-client/http-client.ts](src/mcp-client/http-client.ts)
- [src/mcp-client/sse-client.ts](src/mcp-client/sse-client.ts)
- [src/mcp-client/factory.ts](src/mcp-client/factory.ts)
- [src/mcp-client/registry.ts](src/mcp-client/registry.ts)
- [tests/unit/mcp-connection.test.ts](tests/unit/mcp-connection.test.ts)

**Structure Decision**: Single-project layout under `src/mcp-client/`. The
contract lives in `types.ts` (SPEC); a shared abstract `BaseMCPClient`
(`base-client.ts`) holds all transport-agnostic behavior so each transport
subclass (`stdio-client.ts`, `http-client.ts`, `sse-client.ts`) only overrides
`createTransport()`. `factory.ts` keeps transport selection in one exhaustive
switch, and `registry.ts` is the single coordinator the Hub wires in for all
backend lifecycle. Design decisions are traced to git history:

- **`d50c6a1`** — initial stdio/HTTP/SSE clients, factory, and registry: the
  base-class + per-transport-subclass + factory + registry shape.
- **`217ceef`** — do not require env for disabled MCPs; stream backend stderr
  (`stderr: 'inherit'`); offline demo support.
- **`16c2aac`** — OAuth store/provider and registry integration with configurable
  public URL; the HTTP OAuth hooks surfaced here (OAuth flow detailed in spec
  002).

## Complexity Tracking

> No constitution violations — table intentionally empty.
