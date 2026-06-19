# Feature Specification: Persistence & Logging

**Feature Branch**: `007-persistence-logging`

**Created**: 2026-06-16

**Status**: Implemented

**Input**: Retroactive documentation of MORPH's logging and persistence subsystem.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Live tool-call activity (Priority: P1)

An operator watching the MORPH dashboard sees tool calls as they happen — which
backend MCP and tool was invoked, when, how long it took, and how many tokens
TOON conversion saved — without refreshing or waiting on a database query.

**Why this priority**: Live visibility is the primary feedback loop that tells an
operator the gateway is healthy and actively saving tokens. It is the MVP: useful
on its own even with no durable history.

**Independent Test**: Start the gateway, invoke a backend tool, and confirm the
new entry appears immediately in the live log feed with its mcp/tool/duration and
token-savings fields populated.

**Acceptance Scenarios**:

1. **Given** the gateway is running with the dashboard open, **When** a backend
   tool is invoked, **Then** a corresponding log entry is streamed to the live
   feed within the same call cycle.
2. **Given** more entries arrive than the live buffer can hold, **When** new
   entries are appended, **Then** the oldest entries are dropped and the most
   recent set is always available.
3. **Given** an operator filters the live feed by MCP or level, **When** the
   filter is applied, **Then** only matching recent entries are shown.

---

### User Story 2 - Query full history with savings detail (Priority: P2)

An operator later opens a specific call to inspect its full input, its raw output,
the converted output, and the exact token counts before and after conversion — even
for calls that have aged out of the live buffer.

**Why this priority**: Deep inspection and durable lookup turn live monitoring into
an auditable record. It depends on persistence existing but is independent of the
live feed.

**Independent Test**: Record several calls, then fetch one by its id and confirm
the full detail (input, raw output, converted output, original/TOON token counts)
is returned, including after the live buffer has cycled past it.

**Acceptance Scenarios**:

1. **Given** a call has been recorded, **When** the operator requests that log by
   its id, **Then** the full persisted detail is returned.
2. **Given** an id shown in the live feed, **When** the operator opens its detail,
   **Then** the same id resolves to the same persisted record (live and durable
   ids are identical).
3. **Given** filters for mcp, level, or a time window, **When** history is queried,
   **Then** the matching persisted entries are returned newest-first.

---

### User Story 3 - Aggregate savings over time (Priority: P3)

An operator reviews totals — total calls, total tokens saved, total duration, and
the average savings percentage — and a time-bucketed savings trend, to demonstrate
the cumulative value the gateway delivers.

**Why this priority**: Aggregated totalizers and trends communicate ROI. They build
on the same persisted records and are independently valuable for reporting.

**Independent Test**: Record calls across a span of time, then read the totalizers
and the savings history and confirm the aggregates match the recorded data.

**Acceptance Scenarios**:

1. **Given** recorded calls, **When** totalizers are read, **Then** total JSON
   tokens, TOON tokens, tokens saved, and average savings percent are reported.
2. **Given** recorded calls spanning multiple hours, **When** the savings history
   is requested, **Then** results are bucketed per hour with per-bucket tokens
   saved and call counts.
3. **Given** the gateway is restarted, **When** totals are read again, **Then**
   previously recorded history and aggregates are still present.

---

### Edge Cases

- What happens when a call has no token-savings data (e.g., result below the TOON
  threshold)? Savings fields are absent/null and excluded from aggregates rather
  than counted as zero-savings noise.
- How does the system handle a restart? The live buffer is empty on restart while
  durable history and aggregates remain intact.
- What happens when the live buffer reaches capacity? It behaves as a circular
  buffer, retaining only the most recent entries.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST stream each tool call as a live log entry to dashboard
  subscribers as it occurs.
- **FR-002**: System MUST retain only the most recent N live entries in memory,
  dropping the oldest when capacity is exceeded.
- **FR-003**: System MUST persist every recorded call and log entry durably so it
  survives a gateway restart.
- **FR-004**: System MUST assign each entry a single identifier that is identical
  in the live feed and in durable storage, so an id seen live resolves to the same
  persisted record.
- **FR-005**: System MUST allow retrieval of a single log entry by id, including
  its full input, raw output, converted output, and before/after token counts.
- **FR-006**: System MUST support filtering log queries by MCP, level, and time
  window, returning results newest-first.
- **FR-007**: System MUST aggregate call totals (count, tokens saved, duration) and
  totalizers (JSON tokens, TOON tokens, tokens saved, average savings percent).
- **FR-008**: System MUST provide a time-bucketed (hourly) savings trend.
- **FR-009**: System MUST write logger output to stderr so it never corrupts the
  stdio MCP protocol carried on stdout.

### Key Entities *(include if feature involves data)*

- **Log Entry**: A record of one tool call for inspection — its mcp/tool, level,
  message, full input, raw output, converted output, before/after token counts,
  duration, tokens saved, and timestamp. Exists in both the live buffer and durable
  store under one shared id.
- **Call Stat**: A lightweight time-series record of a call (mcp/tool, duration,
  tokens saved, timestamp) used for aggregation and trend queries.
- **Totalizer**: An aggregate view across all recorded data — total JSON tokens,
  total TOON tokens, total tokens saved, and average savings percentage.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A tool call appears in the live feed within the same call cycle in
  which it completes.
- **SC-002**: 100% of recorded calls remain queryable by id after a restart.
- **SC-003**: An id displayed in the live feed resolves to the identical persisted
  record 100% of the time (no id drift between stores).
- **SC-004**: Totalizers and hourly savings trends match the underlying recorded
  data exactly.

## Assumptions

- A single MORPH instance owns its local durable store; multi-instance shared
  storage is out of scope.
- The live buffer is intentionally volatile; durability is delegated entirely to
  the persistent store.
- Operators consume this data through the Web UI / HTTP API surface; the storage
  contract here is consumed by that surface rather than directly by end users.
