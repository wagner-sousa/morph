# Feature Specification: Demo & Test MCP Servers

**Feature Branch**: `009-demo-servers`

**Created**: 2026-06-16

**Status**: Implemented

**Input**: User description: "Self-contained demo MCP servers that exercise every transport type and feature MORPH supports, so the gateway can be run and tested end-to-end without external dependencies."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run MORPH end-to-end offline (Priority: P1)

A developer evaluating or developing MORPH wants to start the gateway and route real
tool calls through representative backends for every supported transport — stdio,
streamable HTTP, SSE, HTTP+OAuth, and stdio-with-parameters — without installing or
configuring any third-party MCP server or network service.

**Why this priority**: MORPH is a gateway; it is meaningless to demo or evaluate without
backends behind it. Offline, dependency-free backends are the prerequisite for every
other demo, tutorial, and manual smoke test.

**Independent Test**: Point a demo config at the five servers, start MORPH, list tools,
and call `ping`/`users` through each transport; verify TOON-converted results return.

**Acceptance Scenarios**:

1. **Given** the demo config referencing all five servers, **When** MORPH starts and a
   client lists tools, **Then** tools from every transport variant appear in the
   aggregated catalog.
2. **Given** a running stdio/http/sse demo server, **When** a client calls `users`,
   **Then** a uniform user array is returned and converted to TOON by the gateway.
3. **Given** the OAuth demo server, **When** a client presents the bearer token
   `demo-token`, **Then** the `/mcp` endpoint authorizes the request and returns tool
   results; without it the endpoint returns 401.
4. **Given** the parameterized stdio server with `--base-path`, **When** `read`/`write`/
   `list`/`stats` are called, **Then** operations are confined to the base path and a
   path-traversal attempt is denied.

---

### User Story 2 - Deterministic backends for CI / integration tests (Priority: P1)

CI and integration tests need real MCP round-trips against deterministic backends to
verify routing, transport handling, and TOON conversion — without flaky external
services.

**Why this priority**: Test-First is a constitution principle (III); reliable, local
backends make integration tests reproducible and fast.

**Independent Test**: Run the unit and integration suites; they spawn the servers,
perform round-trip tool calls, and assert on responses and errors.

**Acceptance Scenarios**:

1. **Given** the integration suite, **When** it spawns a demo/test server and calls a
   tool, **Then** the real MCP round-trip succeeds and the routed result matches.
2. **Given** the test fixture server, **When** `fail` is called, **Then** an MCP tool
   error is surfaced; **When** `delay` is called, **Then** latency is simulated.

---

### Edge Cases

- Requesting `users`/`large_json` with an out-of-range `count` is clamped to safe bounds.
- An unknown tool name returns an MCP `isError` result rather than crashing the server.
- A missing or wrong OAuth bearer token yields HTTP 401 with a `WWW-Authenticate` header.
- A path outside the parameterized server's base path is rejected ("Path traversal denied").

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The suite MUST provide a backend for each supported transport: stdio,
  streamable HTTP, SSE, HTTP with OAuth, and stdio with launch parameters.
- **FR-002**: Servers MUST be self-contained and run fully offline, depending only on the
  already-bundled MCP SDK.
- **FR-003**: Demo servers MUST expose at least `ping`, `echo`, and a uniform-array tool
  (`users`) suitable for demonstrating TOON conversion.
- **FR-004**: The HTTP and SSE servers MUST listen on configurable ports (defaults 3200
  HTTP, 3201 SSE, 3202 OAuth) and emit logs to stderr.
- **FR-005**: The OAuth demo server MUST publish authorization-server metadata, support
  dynamic client registration, expose authorize/token endpoints, and accept `demo-token`
  as the bearer/apiKey credential on `/mcp`.
- **FR-006**: The parameterized stdio server MUST accept a `--base-path` argument, confine
  all file operations to that base, deny path traversal, and support a `DEMO_MODE` flag.
- **FR-007**: A demo configuration MUST wire all five servers as MORPH backends so the
  gateway can be exercised against them with one command.
- **FR-008**: A minimal test fixture server (`echo`/`fail`/`delay`/`large_json`) MUST be
  available for integration tests covering success, error, latency, and large-array paths.
- **FR-009**: All servers MUST run via `tsx` from source in the dev stack and tests (no
  compiled `dist/` requirement) and MUST NOT be part of the gateway runtime.

### Key Entities

- **Demo Server**: A standalone MCP server process exposing tools, used to exercise MORPH
  end-to-end. Attributes: transport variant, exposed tools, port/command, credentials.
- **Transport Variant**: The MCP transport a demo server speaks — stdio, streamable HTTP,
  SSE, or HTTP+OAuth — plus the stdio+parameters variant.
- **Test Fixture Server**: A deterministic MCP server for integration tests, exposing
  controllable behaviors (echo, fail, delay, large JSON).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer can start MORPH and successfully call a tool through all five
  transport variants with zero external dependencies.
- **SC-002**: 100% of integration tests perform real MCP round-trips against these local
  servers (no external network calls).
- **SC-003**: The OAuth flow (metadata → register → token → authenticated `/mcp`) and the
  401-without-token path both succeed deterministically.
- **SC-004**: The parameterized server confines all operations to `--base-path` and denies
  every path-traversal attempt.

## Assumptions

- The MCP SDK is bundled in `node_modules`; no other backend software is installed.
- Servers are intended for development, demos, and tests — not production gateway runtime.
- Default ports 3200–3202 are free in the dev/CI environment (overridable via env vars).
