# Feature Specification: Web API & Morph Studio Dashboard

**Feature Branch**: `006-web-api-studio`

**Created**: 2026-06-16

**Status**: Implemented

**Input**: Operators need a browser-based control plane for MORPH — manage backend MCP servers, watch tool calls in real time, and see TOON token savings — instead of editing config files and reading stderr logs by hand.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Manage backend MCPs through a dashboard (Priority: P1)

An operator opens Morph Studio and sees every configured backend MCP with its
connection status. They add a new MCP via a form, edit an existing one, restart a
connection, or remove an MCP — all without touching `.mcp.json` by hand.

**Why this priority**: Configuring backend MCPs is the core operational task; without
it the gateway has nothing to proxy. It is the MVP.

**Independent Test**: Create, edit, and delete an MCP through the UI/REST API and confirm
the change is persisted and applied to the live registry.

**Acceptance Scenarios**:

1. **Given** the Studio is open, **When** the operator submits the add-MCP form, **Then** the MCP is validated against the config schema, persisted, connected, and appears in the list (HTTP 201).
2. **Given** an existing MCP, **When** the operator edits and saves it, **Then** the config is re-applied and saved; mismatched name/URL is rejected (HTTP 400).
3. **Given** an existing MCP, **When** the operator deletes it, **Then** it is removed from config and the registry (HTTP 204).
4. **Given** a connected MCP, **When** the operator clicks restart, **Then** it disconnects and reconnects.

---

### User Story 2 - Watch live tool-call logs and inspect a single call (Priority: P1)

An operator watches tool calls stream into the Studio in real time. They click one call
to open a detail view showing the request, the raw JSON result, the converted TOON output
side-by-side, and the token savings for that call.

**Why this priority**: Live observability and per-call inspection are the primary reason an
operator opens the dashboard; this is where token savings become visible.

**Independent Test**: Trigger a tool call, see it appear live, open its detail and confirm
JSON-vs-TOON and token counts are shown.

**Acceptance Scenarios**:

1. **Given** the Logs view is open, **When** a tool call completes, **Then** a new log entry appears live (pushed over WebSocket) without a manual refresh.
2. **Given** a log list, **When** the operator opens a single entry, **Then** the input JSON, the JSON result, the TOON text, and the per-call token counts/savings are shown.
3. **Given** filters (mcp/level/since/limit), **When** applied, **Then** the log query returns only matching entries.

---

### User Story 3 - See aggregate token savings on a dashboard (Priority: P2)

An operator opens the Dashboard and sees totals — total calls, total tokens before/after,
and overall savings — as headline widgets, plus a savings history chart.

**Why this priority**: Aggregate savings prove the product's value (Constitution V) but are
secondary to per-call observability.

**Independent Test**: Run several calls, open the Dashboard, confirm totalizers and totals
match the recorded calls.

**Acceptance Scenarios**:

1. **Given** recorded calls, **When** the Dashboard loads, **Then** it shows totalizers (overall counts and savings).
2. **Given** a `since` window, **When** call totals are requested, **Then** totals are scoped to that window.

---

### User Story 4 - Browse each MCP's tools with a JSON/TOON toggle (Priority: P2)

An operator opens an MCP card and browses its exposed tools, toggling each tool's schema
between JSON and TOON representations.

**Why this priority**: Helps operators understand what each backend exposes and previews
TOON output; complements but is not required for management.

**Independent Test**: Open an MCP, list its tools, toggle JSON/TOON on a tool.

**Acceptance Scenarios**:

1. **Given** an MCP, **When** its detail is opened, **Then** its tools are listed.
2. **Given** a tool, **When** the JSON/TOON toggle is switched, **Then** the corresponding representation is shown.

---

### User Story 5 - Authorize OAuth MCPs and edit settings (Priority: P3)

An operator starts an OAuth flow for a backend that requires it (popup → callback →
success message), and edits gateway settings through forms.

**Why this priority**: Needed only for OAuth-protected backends and configuration tuning.

**Independent Test**: Start OAuth for an OAuth MCP, complete the callback, confirm status
becomes authorized; change a setting and confirm it persists.

**Acceptance Scenarios**:

1. **Given** an OAuth MCP, **When** the operator starts OAuth, **Then** an authorization URL is returned and the callback completes and reconnects on success.
2. **Given** the Settings page, **When** the operator saves config, **Then** it is validated, applied, and persisted.

---

### Edge Cases

- Adding an MCP whose name already exists → rejected (409 ALREADY_EXISTS).
- Requesting a non-existent MCP or log id → 404.
- Invalid config / schema-violating MCP definition → 400/422.
- Malformed WebSocket frames → ignored; `ping` answered with `pong`.
- Auth enabled (`MORPH_WEB_USERNAME`) → `/api` and `/ws` require HTTP Basic, else 401.
- Unknown non-API route → SPA `index.html` fallback.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST expose backend MCP status and tools over a REST API (`/api/mcps`, `/api/mcps/:name`, `/api/mcps/:name/tools`).
- **FR-002**: Operators MUST be able to create, edit, and delete backend MCPs, validated against the config schema and persisted to disk.
- **FR-003**: Operators MUST be able to restart an MCP connection.
- **FR-004**: System MUST stream tool-call logs to connected clients in real time over a WebSocket (`/ws`), with an SSE fallback.
- **FR-005**: System MUST allow querying historical logs with filters (mcp, level, since, limit) and retrieving a single log's full detail including input JSON, output JSON, TOON text, and token counts.
- **FR-006**: System MUST expose call totals (optionally windowed by `since`) and overall totalizers.
- **FR-007**: System MUST expose TOON savings stats and savings history.
- **FR-008**: System MUST support OAuth authorization for backends that require it (status / start / callback).
- **FR-009**: System MUST allow reading and updating gateway configuration via the API, and reloading from disk.
- **FR-010**: System MUST serve the built Morph Studio SPA with an index.html fallback for client routes.
- **FR-011**: System MUST optionally enforce HTTP Basic auth on `/api` and `/ws` when credentials are configured.
- **FR-012**: Every tool result surfaced MUST pass through the TOON converter so JSON/TOON and savings are consistent (Constitution V).

### Key Entities *(include if feature involves data)*

- **MCP config record**: a backend server definition (name, transport, env, aliases/prefix) — validated by the config zod schema; lives in `.mcp.json`.
- **Log entry**: one tool call — id, mcp, tool, level, timestamp, input JSON, output JSON, TOON text, before/after token counts.
- **Call totals / totalizers**: aggregate counts and token-savings rollups across recorded calls.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An operator can add, edit, or remove a backend MCP through the dashboard with no manual file editing.
- **SC-002**: A completed tool call appears in the live log stream within ~1s without a page refresh.
- **SC-003**: For any logged call, the JSON result, TOON output, and per-call token savings are all viewable side-by-side.
- **SC-004**: The Dashboard reports total calls and overall token savings consistent with recorded calls.
- **SC-005**: All write endpoints reject schema-invalid input with a 4xx error and a stable error code.

## Assumptions

- The Studio frontend is built and served from the backend's `./public`; in dev, Vite (`:5173`) proxies `/api` and `/ws` to the backend (`:3101`).
- Backend MCP definitions remain the single source of truth in `.mcp.json` (zod-validated).
- A single trusted operator (or small team) uses the dashboard; auth is optional via env.
