# Feature Specification: MCP Client Transports & Registry

**Feature Branch**: `001-mcp-client-transports`

**Created**: 2026-06-16

**Status**: Implemented

**Input**: Retroactive documentation of how MORPH connects to backend MCP servers over multiple transports and manages their lifecycle.

## User Scenarios & Testing *(mandatory)*

MORPH is a gateway that aggregates many backend MCP servers and re-exposes their
tools to an AI agent. Before any aggregation, conversion, or routing can happen,
MORPH must be able to *connect* to each backend regardless of how that backend
speaks MCP — as a local child process (stdio) or as a remote service (Streamable
HTTP or SSE) — and keep those connections healthy over the lifetime of the
gateway. This feature is that connection layer.

### User Story 1 - Connect to backends over any supported transport (Priority: P1)

As a MORPH operator, I declare a set of backend MCP servers in configuration and
expect MORPH to connect to each one using the transport it requires — a spawned
local command, a Streamable HTTP endpoint, or a legacy SSE endpoint — so their
tools become available through the gateway.

**Why this priority**: Without a working connection to backends there is nothing
to aggregate, convert, or proxy. This is the foundational MVP slice; everything
else in MORPH depends on it.

**Independent Test**: Configure one stdio backend and one remote backend, start
MORPH, and confirm both reach a connected state and report their tool lists.

**Acceptance Scenarios**:

1. **Given** a backend declared with a stdio transport (command + args),
   **When** MORPH starts, **Then** it spawns the child process, completes the MCP
   handshake, and the backend is reported as connected with its tools listed.
2. **Given** a backend declared with a Streamable HTTP transport (URL, optional
   headers/API key), **When** MORPH starts, **Then** it connects over HTTP and
   the backend is reported as connected with its tools listed.
3. **Given** a backend declared with an SSE transport, **When** MORPH starts,
   **Then** it connects over SSE (injecting any configured auth headers) and the
   backend is reported as connected with its tools listed.
4. **Given** a connected backend, **When** the agent invokes one of its tools,
   **Then** MORPH forwards the call to that backend and returns the tool result.

---

### User Story 2 - Manage backend connection lifecycle at runtime (Priority: P2)

As a MORPH operator, I want backends to be added, removed, reconnected, and
hot-updated at runtime so configuration changes take effect without restarting
the gateway, and so a single failing backend never takes down the others.

**Why this priority**: Hot configuration reload and resilience are core to a
long-running gateway, but they build on top of the ability to connect (US1).

**Independent Test**: Start MORPH with several backends, then add, update, and
remove one at runtime and confirm the others stay connected throughout.

**Acceptance Scenarios**:

1. **Given** several backends being initialized, **When** one of them fails to
   connect, **Then** the failure is logged and the remaining backends still
   connect successfully (one bad backend does not abort startup).
2. **Given** a connected backend, **When** its definition is updated at runtime,
   **Then** MORPH disconnects the old client and reconnects with the new
   definition.
3. **Given** a backend, **When** it is removed at runtime, **Then** its client is
   disconnected and it no longer appears in the gateway's tool set.
4. **Given** a connection attempt that fails transiently, **When** MORPH
   connects, **Then** it retries up to a bounded number of attempts before
   marking the backend as errored.
5. **Given** a backend whose transport closes unexpectedly, **When** the close is
   detected, **Then** the backend transitions to a disconnected state and emits a
   disconnected event.

---

### User Story 3 - Skip disabled backends and surface backend diagnostics (Priority: P3)

As a MORPH operator, I want disabled backends to be registered but never
connected (and never required to have credentials), and I want each backend's
status, tool count, latency, and last error to be observable, including the raw
backend logs for troubleshooting.

**Why this priority**: Operational ergonomics — keeping disabled backends in
config without breaking startup, and exposing health — matters for real use but
is not required for the core connect/proxy path.

**Independent Test**: Mark a backend disabled (with no credentials) and confirm
MORPH starts cleanly, lists it as disabled, and never attempts to connect it.

**Acceptance Scenarios**:

1. **Given** a backend marked disabled, **When** MORPH starts, **Then** the
   backend is registered with a disabled status and no connection is attempted.
2. **Given** a disabled backend with missing environment/credentials, **When**
   MORPH starts, **Then** startup succeeds and no credential error is raised for
   that backend.
3. **Given** a running stdio backend that writes to its stderr, **When** it logs,
   **Then** those backend logs are streamed through so an operator can read them.
4. **Given** any registered backend, **When** an operator inspects status,
   **Then** they can see its enabled flag, connection status, transport type,
   tool count, latency, last ping time, and last error.

---

### Edge Cases

- A backend definition uses an unknown transport type → creation fails fast with
  a clear error rather than silently producing a non-functional client.
- A tool call is attempted against a backend that is not connected → the call is
  rejected with a clear "not connected" error including current status.
- Attempting to register a backend whose name is already registered → rejected to
  avoid silent duplication.
- A remote HTTP backend responds with an authorization challenge (401) → backend
  is flagged as needing OAuth (OAuth flow itself is specified in spec 002).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST connect to a backend MCP server over stdio by spawning
  a child process with a configured command, arguments, working directory, and
  environment.
- **FR-002**: System MUST connect to a backend MCP server over Streamable HTTP
  using a configured URL, optional custom headers, and an optional API key sent
  as a bearer token.
- **FR-003**: System MUST connect to a backend MCP server over SSE using a
  configured URL, propagating configured auth headers to the underlying request.
- **FR-004**: System MUST select the correct transport implementation based on
  the backend's declared transport type, and fail clearly for unknown types.
- **FR-005**: System MUST expose a single uniform client contract across all
  transports for connecting, disconnecting, listing tools, and calling tools.
- **FR-006**: System MUST retry a failed connection up to a bounded number of
  attempts and, on final failure, mark the backend as errored and record the
  error message.
- **FR-007**: System MUST detect unexpected transport closure and transition the
  backend to a disconnected state, emitting lifecycle events
  (connected/disconnected/error/toolListChanged).
- **FR-008**: System MUST manage all backend clients through a central registry
  supporting initialize, add, connect, disconnect, remove, and update (reconnect
  with a new definition) operations at runtime.
- **FR-009**: System MUST isolate backend failures: initializing many backends
  MUST NOT abort because one of them fails to connect.
- **FR-010**: System MUST register disabled backends without connecting them and
  without requiring their environment/credentials to be present.
- **FR-011**: System MUST cache each connected backend's discovered tools and
  allow refreshing them, recording ping latency and last-ping time.
- **FR-012**: System MUST stream a stdio backend's standard error through so its
  logs are visible to the operator.
- **FR-013**: System MUST reject tool calls and tool listings against backends
  that are not in a connected state.
- **FR-014**: System MUST provide a status summary per backend including enabled
  flag, status, transport type, tool count, latency, last ping, and last error.
- **FR-015**: System MUST flag when a remote HTTP backend requires authorization
  and expose the relevant authorization details for the OAuth flow defined in
  spec 002.

### Key Entities *(include if feature involves data)*

- **MCP Client**: A connection to one backend MCP server. Has a name, a status
  (connecting/connected/disconnected/error), a last error, and the ability to
  connect, disconnect, list tools, and call tools. The same contract is honored
  by every transport.
- **Transport**: The mechanism a client uses to talk to its backend — stdio
  (local child process), Streamable HTTP (remote), or SSE (legacy remote). A
  backend declares exactly one transport type with its own settings.
- **Registry**: The coordinator that owns every backend client plus its
  definition and cached tools. It drives the lifecycle (add/remove/update/
  reconnect), isolates failures, caches tool discovery, tracks health, and emits
  lifecycle events upward.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All three transports (stdio, Streamable HTTP, SSE) can connect to a
  conforming backend and list its tools.
- **SC-002**: Starting the gateway with N backends where one is misconfigured
  still connects the other N−1 backends (zero startup aborts from a single
  failure).
- **SC-003**: A disabled backend with no credentials never triggers a connection
  attempt and never blocks startup.
- **SC-004**: A backend can be added, updated, and removed at runtime without
  restarting the gateway and without disconnecting unrelated backends.
- **SC-005**: A failed connection is retried up to the configured maximum before
  the backend is reported as errored, with the error message available in status.
- **SC-006**: For every registered backend an operator can read status, transport
  type, tool count, latency, last ping, and last error.

## Assumptions

- Backends conform to the MCP protocol as implemented by the MCP TypeScript SDK.
- Each backend declares exactly one transport type in configuration.
- Configuration (including `${ENV}` resolution and enabled/disabled state) is
  provided by the config layer and is out of scope here.
- The OAuth authorization flow for HTTP backends is specified separately in
  spec 002; this feature only surfaces the hooks (needs-OAuth, authorization URL,
  token presence) that flow integrates with.
