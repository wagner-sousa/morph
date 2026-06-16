# Feature Specification: Tool Router

**Feature Branch**: `003-tool-router`

**Created**: 2026-06-16

**Status**: Implemented

**Input**: Retroactive specification for the MORPH tool router that aggregates the tools of many backend MCP servers into a single agent-facing tool list and resolves name conflicts deterministically.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Unified tool list across many backends (Priority: P1)

An AI agent connects to MORPH and sees one flat tool list aggregated from every configured backend MCP server, without needing to know which server provides which tool. When the agent calls a tool by its exposed name, MORPH routes the call to the correct backend and original tool name.

**Why this priority**: This is the core value of the gateway — a single connection point that hides backend topology. Without it there is no aggregation and no product.

**Independent Test**: Configure two backends with distinct tool names, list tools, and confirm every tool appears once and each call resolves to the right backend.

**Acceptance Scenarios**:

1. **Given** two backends `fs` (`read_file`) and `clickup` (`create_task`) with no conflicts, **When** the agent lists tools, **Then** both `read_file` and `create_task` are exposed under their original names.
2. **Given** the aggregated list, **When** the agent calls `read_file`, **Then** MORPH resolves it to backend `fs`, original tool `read_file`.
3. **Given** an unknown tool name, **When** the agent calls it, **Then** MORPH raises a "tool not found" error rather than guessing a backend.

---

### User Story 2 - Deterministic conflict resolution (Priority: P1)

When two or more backends expose the same tool name, MORPH resolves the clash by a fixed, predictable order so the exposed tool list is stable across restarts and reloads.

**Why this priority**: Aggregating real backends inevitably produces name collisions; non-deterministic resolution would make tool names unstable and break agents.

**Independent Test**: Configure two backends that both expose the same tool name and confirm the exposed names follow the documented order.

**Acceptance Scenarios** (the fixed 4-step order):

1. **Given** a backend has an explicit alias for a tool, **When** routes are built, **Then** the alias wins and is used as the exposed name regardless of any other backend (step 1: explicit `aliases`).
2. **Given** a global `toolPrefix` template is configured, **When** routes are built, **Then** every tool is exposed with the rendered prefix and no unprefixed name is exposed (step 2: global `toolPrefix`).
3. **Given** no alias and no `toolPrefix`, and two backends expose the same name, **When** routes are built, **Then** each conflicting tool is auto-prefixed as `${mcp}_${tool}` and the bare name is not exposed (step 3: auto-prefix conflicts).
4. **Given** `allowConflicts` is enabled (and no `toolPrefix`), and two backends expose the same name, **When** routes are built, **Then** the last backend wins under the bare name and a warning is logged (step 4: last-wins with warning).

---

### User Story 3 - Operator renames tools (Priority: P2)

An operator wants control over the names agents see — either renaming individual tools via per-backend `aliases`, or namespacing everything with one global `toolPrefix` template such as `{name}_`.

**Why this priority**: Operators need to disambiguate, shorten, or brand tool names without touching backend servers, but aggregation already works without it.

**Independent Test**: Set an alias for one tool and a global prefix in another run; confirm exposed names match.

**Acceptance Scenarios**:

1. **Given** an alias `read_file → fs_read` on backend `fs`, **When** routes are built, **Then** the tool is exposed as `fs_read` and resolves to `fs`/`read_file`.
2. **Given** `toolPrefix: "{name}_"`, **When** routes are built, **Then** `stripe`'s `get_balance` is exposed as `stripe_get_balance`.
3. **Given** `toolPrefix: "{name}:"`, **When** routes are built, **Then** the template token renders so the tool is exposed as `stripe:get_balance`.

---

### Edge Cases

- A `toolPrefix` rendering still collides (e.g. same prefixed name from two backends): the router appends a numeric suffix (`_2`, `_3`, …) until the exposed name is unique.
- `toolPrefix` takes precedence over `allowConflicts`: when a prefix is set, the last-wins path is never taken — everything is prefixed.
- An empty `toolPrefix` preserves the default behaviour (original names, auto-prefix only on conflict).
- Rebuilding routes clears all previous routes and tool definitions so reloads do not leak stale names.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST aggregate the tools discovered from all configured backend MCP servers into a single agent-facing tool list.
- **FR-002**: System MUST resolve an exposed tool name to exactly one backend and its original tool name.
- **FR-003**: System MUST raise a "tool not found" error when an agent calls an unknown exposed name.
- **FR-004**: System MUST honour explicit per-backend `aliases` as the highest-priority source of exposed names.
- **FR-005**: When a global `toolPrefix` template is set, System MUST expose every tool with the rendered prefix and MUST NOT expose any bare name.
- **FR-006**: With no alias and no prefix, System MUST auto-prefix conflicting tool names as `${mcp}_${tool}`.
- **FR-007**: When `allowConflicts` is set (and no prefix), System MUST resolve conflicts last-wins under the bare name and MUST log a warning.
- **FR-008**: System MUST render the `{name}` token in a `toolPrefix` template to the backend MCP name.
- **FR-009**: System MUST guarantee unique exposed names, appending a numeric suffix when a prefixed name would still collide.
- **FR-010**: System MUST clear all prior routes on rebuild so hot-reload produces a clean table.

### Key Entities *(include if feature involves data)*

- **Route**: A mapping from an exposed tool name → (`mcpName`, `originalName`). The unit the router stores and resolves against.
- **Alias**: A per-backend `originalName → exposedName` override; the highest-priority renaming source.
- **Prefix template**: A global string with a `{name}` token (e.g. `{name}_`, `{name}:`, `{name}.`) rendered with the backend name to namespace every tool.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of distinct (non-conflicting) backend tools are exposed exactly once under their original names.
- **SC-002**: Conflict resolution is deterministic — the same configuration produces an identical exposed tool list on every build, with zero unresolved bare-name collisions.
- **SC-003**: Every exposed tool name resolves to exactly one backend; no exposed name is ambiguous.
- **SC-004**: The documented 4-step order (alias → prefix → auto-prefix → last-wins) is fully exercised and covered by the unit suite.

## Assumptions

- Backend tools have already been discovered and are provided to the router grouped by backend MCP name.
- TOON conversion of tool results is handled downstream; routing is name-resolution only.
- Configuration (`aliases`, `toolPrefix`, `allowConflicts`) is supplied by the loaded gateway config.
