# Feature Specification: TOON Converter

**Feature Branch**: `004-toon-converter`

**Created**: 2026-06-16

**Status**: Implemented

**Input**: Document retroactively the core MORPH capability — converting JSON tool
results into TOON (Token-Oriented Object Notation) to cut agent token usage 30–60%.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Agent receives compact TOON instead of verbose JSON (Priority: P1)

An AI agent calls a backend MCP tool through MORPH. Instead of relaying the verbose
JSON the backend returned, MORPH converts the JSON text content into TOON — a denser,
table-like representation — before the result reaches the agent. The agent reads the
same data while consuming substantially fewer tokens.

**Why this priority**: This is the reason MORPH exists. Every other capability serves
this token-reduction goal.

**Independent Test**: Call any backend tool that returns a JSON array of objects and
confirm the relayed content is TOON-formatted and shorter than the original JSON.

**Acceptance Scenarios**:

1. **Given** a backend returns a uniform array of objects as JSON text, **When** the
   result passes through MORPH, **Then** the text content is replaced with TOON and the
   agent receives 30–60% fewer tokens for that payload.
2. **Given** a tool result containing non-text content (e.g. an image), **When** the
   result passes through MORPH, **Then** that content item is passed through untouched.
3. **Given** a text item that is not valid JSON, **When** the result passes through
   MORPH, **Then** the text is passed through unchanged.

---

### User Story 2 - Small or non-beneficial payloads pass through (Priority: P2)

When converting a payload would not actually help — the TOON output is the same size or
larger than the source JSON — MORPH keeps the original JSON so the agent never receives a
worse representation.

**Why this priority**: Protects the savings guarantee; a conversion that increases size
would violate the product goal.

**Independent Test**: Feed a tiny or already-compact JSON value and confirm the original
text is preserved when TOON would not be smaller.

**Acceptance Scenarios**:

1. **Given** a JSON payload whose TOON encoding is not shorter than the original,
   **When** the result passes through MORPH, **Then** the original JSON text is retained
   and the item is reported as not converted.
2. **Given** a payload that fails to encode for any reason, **When** conversion is
   attempted, **Then** the original result is returned unchanged (conversion never breaks
   a real response).

---

### User Story 3 - Token savings are measured and reported (Priority: P3)

Each conversion records how many tokens the original JSON would have cost versus the TOON
output, exposing the savings as a percentage so users and dashboards can verify the
product is delivering value.

**Why this priority**: Savings must be observable to be trusted; supports the SQLite
savings history and Web UI.

**Independent Test**: Convert a known payload and confirm original/TOON token counts and a
savings percentage are attached.

**Acceptance Scenarios**:

1. **Given** a payload is converted to TOON, **When** the conversion completes, **Then**
   per-item `_meta` carries `morph/format`, original tokens, TOON tokens, and savings
   percent, and an aggregate savings figure is produced for the whole result.

---

### Edge Cases

- **Empty arrays / non-uniform arrays**: still pass through the converter; output is kept
  only if smaller than the source.
- **Deeply nested objects**: TOON benefit is minimal; the size guard keeps JSON when TOON
  is not smaller.
- **Result with no `content` array**: returned unchanged, not converted.
- **Mixed content (text + non-text)**: only JSON text items are eligible; others untouched.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST intercept every MCP tool result — backend tools and built-in
  `_morph_*` tools alike — and route its content through the TOON converter.
- **FR-002**: System MUST convert a content item only when it is `text` content that
  parses as JSON (starting with `[` or `{`); all other items pass through untouched.
- **FR-003**: System MUST retain the original JSON when the TOON encoding is not strictly
  smaller than the source text (size guard).
- **FR-004**: System MUST never let a conversion error break a response — on encode
  failure the original item/result is returned unchanged.
- **FR-005**: System MUST attach per-item savings metadata (`morph/format`, original
  tokens, TOON tokens, savings percent) to every converted item.
- **FR-006**: System MUST produce an aggregate token-savings figure across all converted
  items in a result.
- **FR-007**: System MUST force TOON conversion on all eligible results, bypassing the
  earlier `toon.autoConvert` gate and per-payload `decideConvert` heuristic, so behavior
  is consistent across every tool call.
- **FR-008**: System MUST honor the configured TOON encoding options (indent, delimiter,
  and key-folding derived from flatten depth) when encoding.
- **FR-009**: System MUST estimate token counts with a consistent heuristic
  (~4 chars/token) for dashboard/reporting purposes (not billing-exact).

### Key Entities *(include if feature involves data)*

- **Conversion Result**: the (possibly modified) tool result plus a `converted` flag and
  an optional aggregate savings figure.
- **Savings Metric**: original bytes/tokens, TOON bytes/tokens, and savings percent for a
  single conversion or an aggregate.
- **Optimizer Strategy**: structural heuristics (uniform-array detection, max-depth, size
  threshold) describing where TOON helps most; retained as a library but no longer gating
  the forced conversion path.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Uniform arrays of objects are reduced by 30–60% in token count after
  conversion.
- **SC-002**: 100% of MCP tool results (backend and built-in) flow through the converter.
- **SC-003**: No converted result is ever larger than its source JSON (size guard holds
  in 100% of cases).
- **SC-004**: Every converted item carries measurable savings metadata that matches the
  aggregate within rounding.

## Assumptions

- Backend tools that return structured data emit it as JSON text content.
- A ~4-chars-per-token estimate is acceptable for dashboards; exact tokenization is
  model-dependent and out of scope.
- TOON output remains losslessly decodable back to the original data.
