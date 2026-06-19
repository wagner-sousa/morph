# Feature Specification: Configuration System

**Feature Branch**: `005-config-system`

**Created**: 2026-06-16

**Status**: Implemented

**Input**: User description: "Operators must be able to configure the gateway's behavior and its backend MCP servers in plain, human-editable files, change them while the gateway is running, keep secrets out of those files, and get a clear error when a file is wrong."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configure gateway and backends in two editable files (Priority: P1)

An operator sets up MORPH by editing two separate JSON files: one that controls how the
gateway behaves (logging, tool-naming, TOON output, web UI, health checks) and one that
lists the backend MCP servers to aggregate. Keeping gateway behavior and the backend
inventory apart lets an operator add or remove a server without touching unrelated gateway
settings, and lets the backend list follow the familiar keyed-object shape used by other
MCP clients.

**Why this priority**: Without a configuration surface the gateway cannot know which
backends to connect to or how to behave. This is the minimum viable slice.

**Independent Test**: Place a valid gateway file and a valid backends file on disk, start
the gateway, and confirm it runs with the declared settings and connects to the listed
backends.

**Acceptance Scenarios**:

1. **Given** a valid gateway file and a valid backends file, **When** the gateway starts,
   **Then** it applies the gateway settings and registers every enabled backend.
2. **Given** a backend marked disabled, **When** the gateway starts, **Then** that backend
   is skipped and the others still load.
3. **Given** two backends declared with the same name, **When** the configuration is
   loaded, **Then** loading is rejected with an error naming the duplicate.

---

### User Story 2 - Change configuration without restarting (Priority: P1)

An operator edits a configuration file while the gateway is running — for example to enable
a new backend or raise the TOON conversion threshold — and the change takes effect without
stopping and restarting the process.

**Why this priority**: Zero-downtime reconfiguration is a core operational promise of the
gateway; restarts drop active agent sessions.

**Independent Test**: Start the gateway, edit a watched file, and observe the new settings
take effect within seconds without a restart.

**Acceptance Scenarios**:

1. **Given** the gateway is running, **When** a watched file is saved with a valid change,
   **Then** the new configuration is applied automatically without a restart.
2. **Given** the gateway is running, **When** a watched file is saved with an invalid
   change, **Then** the previous working configuration is retained and the error is
   reported.
3. **Given** a file is saved several times in quick succession, **When** the writes settle,
   **Then** the configuration is reloaded once for the final state (not once per write).

---

### User Story 3 - Keep secrets out of config files via environment placeholders (Priority: P2)

An operator references secrets (API keys, passwords, URLs) using `${VAR}` placeholders
inside the configuration files instead of writing the secret values inline. The placeholders
are filled in from the environment when configuration is loaded, so the files can be
committed and shared without leaking credentials.

**Why this priority**: Required for safe deployment, but the gateway can function with
literal values, so it ranks below the core load/reload stories.

**Independent Test**: Reference an environment variable in a file, set that variable, load
the configuration, and confirm the resolved value is used.

**Acceptance Scenarios**:

1. **Given** a placeholder `${API_KEY}` and a defined `API_KEY` variable, **When**
   configuration is loaded, **Then** the placeholder is replaced with the variable's value.
2. **Given** a placeholder referencing an undefined variable used by an enabled backend or
   by global settings, **When** configuration is loaded, **Then** loading fails with an
   error listing every missing variable.
3. **Given** a placeholder inside a disabled backend referencing an undefined variable,
   **When** configuration is loaded, **Then** loading succeeds and the placeholder is left
   untouched.

---

### User Story 4 - Get a clear error for invalid configuration (Priority: P2)

When a configuration file is malformed or violates the rules (wrong type, missing required
field, out-of-range value), the operator receives a single, readable message pointing at the
offending fields rather than a stack trace or silent failure.

**Why this priority**: Good error feedback dramatically shortens setup and debugging, but
depends on the loading machinery existing first.

**Independent Test**: Load a file with several mistakes and confirm one message enumerates
each problem with its location.

**Acceptance Scenarios**:

1. **Given** a file that is not valid JSON, **When** it is loaded, **Then** loading fails
   with a message saying the file is not valid JSON.
2. **Given** a field with the wrong type or an out-of-range value, **When** the file is
   loaded, **Then** loading fails and the message names the field path and the violated
   rule.

### User Story 5 - Locate config and data via a single directory and env overrides (Priority: P2)

An operator runs MORPH in a container and wants everything it persists — the database, OAuth
sessions, logs, and (optionally) the config files — under one directory so a single volume
mount is enough. The location of each path can be overridden by an environment variable or a
command-line flag, and the backend file is found automatically next to the gateway file.

**Why this priority**: It makes containerized deployment a one-mount operation and keeps
local runs zero-config, but the gateway still works with explicit paths, so it ranks below
the core load/reload stories.

**Independent Test**: Set the data-directory variable, start the gateway with no explicit
config flags, and confirm the database, logs, and config files all resolve under that one
directory.

**Acceptance Scenarios**:

1. **Given** no flags or path variables, **When** the gateway starts, **Then** all persisted
   paths resolve under the default data directory (`./data`), and the config is read from
   `${dataDir}/morph.json` if present, otherwise `./morph.json`.
2. **Given** the data-directory variable is set, **When** the gateway starts, **Then** the
   database, OAuth sessions, and logs all resolve under that directory.
3. **Given** a gateway config path (flag or variable), **When** the backend file path is not
   given explicitly, **Then** it is derived as the sibling of the gateway file, preserving
   any suffix (e.g. `morph.demo.json` → `.mcp.demo.json`).
4. **Given** explicit config/backend path overrides, **When** the gateway starts, **Then**
   those explicit paths take precedence over the directory-based defaults.

---

### Edge Cases

- A configuration file is missing or unreadable on disk → loading fails with a clear path
  and reason.
- Optional sections are omitted entirely → safe defaults are applied.
- A file is deleted or briefly empty mid-write while being watched → the last known-good
  configuration is retained.
- A backend name contains characters outside the allowed set → rejected at load.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST load gateway behavior settings from a dedicated,
  human-editable file separate from the backend server list.
- **FR-002**: The system MUST load the backend MCP server inventory from a dedicated,
  human-editable file using a keyed-object shape familiar to MCP client users.
- **FR-003**: The system MUST apply safe defaults for every optional setting so a minimal
  configuration is valid.
- **FR-004**: The system MUST reject configuration that violates its rules and report all
  problems in a single readable message identifying each offending field.
- **FR-005**: The system MUST reject a backend inventory that declares the same backend
  name more than once.
- **FR-006**: The system MUST allow a backend to be marked disabled and MUST skip disabled
  backends when applying configuration.
- **FR-007**: The system MUST resolve `${VAR}` placeholders in configuration values from
  the process environment at load time.
- **FR-008**: The system MUST fail loading when a placeholder referenced by global settings
  or by an enabled backend resolves to an undefined variable, listing every missing
  variable.
- **FR-009**: The system MUST leave placeholders inside disabled backends unresolved so a
  missing variable there never blocks startup.
- **FR-010**: The system MUST watch the configuration files and apply valid changes while
  running, without requiring a restart.
- **FR-011**: The system MUST retain the last known-good configuration when a live change
  is invalid, and report the error.
- **FR-012**: The system MUST coalesce rapid successive writes so a burst of saves triggers
  a single reload of the final state.
- **FR-013**: The system MUST treat the validated configuration shape as the single source
  of truth, with the editor-facing validation schemas derived from it rather than
  maintained separately.
- **FR-014**: The system MUST root all persisted data (database, OAuth sessions, logs, and
  optionally the config files) under a single data directory, defaulting to `./data` and
  overridable by environment variable.
- **FR-015**: The system MUST resolve the config and backend file locations with explicit
  flags/variables taking precedence, falling back to the data directory and then the working
  directory, and MUST derive the backend file as the suffix-preserving sibling of the
  gateway file when not given explicitly.

### Key Entities *(include if feature involves data)*

- **Gateway settings**: How the gateway itself behaves — version marker, log verbosity,
  tool-name conflict policy, the prefix template applied to exposed tool names, the web UI
  options, and health-check timing.
- **MCP server entry**: One backend the gateway aggregates — a unique name, an
  enabled/disabled flag, optional human description and labels, optional per-tool renaming
  (aliases), and how to reach it (a local command, an HTTP endpoint, or a streaming
  endpoint, each with its own connection details and credentials).
- **TOON options**: How tool results are converted to TOON — whether conversion is
  automatic, the field delimiter, indentation, how deep nested structures are flattened,
  and the size threshold above which conversion applies.
- **Resolved paths**: The set of on-disk locations the gateway uses — the data directory and
  the derived database, OAuth-session, log, gateway-config, and backend-config paths — each
  with a default and an environment/flag override.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An operator can stand up a working gateway with a minimal configuration in
  under 5 minutes using only the two files.
- **SC-002**: A valid change to a watched file takes effect within 1 second of the file
  settling, with zero process restarts and zero dropped sessions.
- **SC-003**: 100% of invalid configurations are rejected; none are silently accepted or
  partially applied.
- **SC-004**: No secret value needs to be written literally into a configuration file;
  every secret can be supplied via an environment placeholder.
- **SC-005**: An invalid configuration produces a single error message that lists every
  problem and its location, so an operator can fix all issues in one pass.
- **SC-006**: A containerized deployment needs exactly one volume mount (the data directory)
  to persist the database, OAuth sessions, logs, and config across restarts.

## Assumptions

- The process environment supplies the secret values referenced by placeholders.
- Operators edit the files with a text editor; no in-product editor is required for this
  feature (though a web UI may exist separately).
- Both files live on a filesystem the gateway can read and watch.
- The keyed-object backend file follows the conventions already familiar from other MCP
  clients.
