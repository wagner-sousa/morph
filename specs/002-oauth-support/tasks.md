---

description: "Task list for OAuth support for backend MCP servers"
---

# Tasks: OAuth Support for Backend MCP Servers

**Input**: Design documents from `/specs/002-oauth-support/`

**Prerequisites**: [plan.md](plan.md) (required), [spec.md](spec.md) (required for user stories)

**Tests**: Included — one unit test per module covers the persistent store (Constitution III).

**Organization**: Tasks are grouped by user story and ordered by git chronology
(`16c2aac` → `0741521` → `90e69e5`). All tasks are complete (`[X]`).

**Status**: Implemented — branch `002-oauth-support`, 2026-06-16.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

## Path Conventions

Single project: `src/`, `tests/` at repository root.

---

## Phase 1: Setup & Foundational (commit `16c2aac`)

**Purpose**: Persistent store, SDK provider, registry wiring, and configurable public URL —
the shared infrastructure every user story depends on.

- [X] T001 Add configurable `publicUrl` field to the zod config contract in
  [src/config/schema.ts](../../src/config/schema.ts) and regenerate schemas.
- [X] T002 [P] [US2] Write store CRUD tests (~7 tests: load/save/get/set/delete/clearPending,
  per-backend persistence) in [tests/unit/oauth-store.test.ts](../../tests/unit/oauth-store.test.ts).
- [X] T003 [US2] Implement the persistent OAuth session store (`OAuthStore`) — load/save
  `oauth-sessions.json`, per-backend `get`/`set`/`delete`/`clearPending` — in
  [src/mcp-client/oauth-store.ts](../../src/mcp-client/oauth-store.ts).
- [X] T004 [US1] Implement `MorphOAuthProvider` against the SDK `OAuthClientProvider`
  interface (redirect URL from `publicUrl`, client metadata, PKCE code-verifier
  save/load, token save/load, DCR client-information save/load, discovery state,
  credential invalidation) in [src/mcp-client/oauth-provider.ts](../../src/mcp-client/oauth-provider.ts).
- [X] T005 [US1] Wire the provider and store into the MCP registry per backend (create
  provider, expose `getOAuthProvider`, `getOAuthUrl`, `hasOAuthToken`, `finishOAuth`,
  status `oauthNeeded`/`oauthUrl`/`oauthHasToken`) so connections trigger and consume the
  OAuth flow.

**Checkpoint**: Persistence and provider exist; tokens load at startup (US2 satisfied).

---

## Phase 2: User Story 1 + US3 — Browser authorization flow & DCR (commit `0741521`)

**Goal**: Operator-facing routes to inspect status, start the flow, and complete the
redirect callback; DCR is exercised transparently through the provider.

**Independent Test**: Hit status → start → complete consent in a browser → callback, and
confirm the backend reconnects as authorized.

- [X] T006 [US1] Implement `GET /api/mcps/:name/oauth/status` returning
  `oauthNeeded`, `oauthUrl`, `oauthHasToken`/`authorized` (404 for unknown backend) in
  [src/web/oauth-routes.ts](../../src/web/oauth-routes.ts).
- [X] T007 [US1] Implement `GET /api/mcps/:name/oauth/start` — short-circuit when already
  authorized, otherwise connect to obtain and return the browser authorization URL; reject
  backends with no OAuth provider in [src/web/oauth-routes.ts](../../src/web/oauth-routes.ts).
- [X] T008 [US1] Implement `GET /api/mcps/:name/oauth/callback` — handle denied/error,
  exchange the code via `finishOAuth`, reconnect, and post the result back to the opener via
  the result HTML page in [src/web/oauth-routes.ts](../../src/web/oauth-routes.ts).
- [X] T009 [US3] Verify Dynamic Client Registration end-to-end: provider persists and reuses
  client information (`clientInformation`/`saveClientInformation`) across flows.

**Checkpoint**: Full browser authorization flow works (US1); DCR onboarding works (US3).

---

## Phase 3: Polish — redirect race fix (commit `90e69e5`)

**Purpose**: Harden the provider against a redirect/await ordering race.

- [X] T010 [US1] Fix the OAuth provider redirect race: `redirectToAuthorization()` stores the
  authorization URL in a `pendingUrl` field, and `waitForRedirect()` checks that field
  before creating a new Promise, so the URL is never lost when the redirect arrives first —
  in [src/mcp-client/oauth-provider.ts](../../src/mcp-client/oauth-provider.ts).

**Checkpoint**: Order-independent handshake; no lost-redirect race (SC-003).

---

## Dependencies & Execution Order

- **Phase 1 (`16c2aac`)**: Foundational — blocks all stories. Schema (T001) and store
  (T002→T003, test-first) precede the provider (T004) and registry wiring (T005).
- **Phase 2 (`0741521`)**: Routes depend on Phase 1's registry surface.
- **Phase 3 (`90e69e5`)**: Hardens the Phase 1 provider after the flow proved out.

### Parallel Opportunities

- T002 (store test) is `[P]` against T001 (config), as they touch different files.

---

## Implementation Strategy

Delivered in git order: foundational store/provider/registry + `publicUrl` (`16c2aac`) →
status/start/callback routes (`0741521`) → redirect race fix (`90e69e5`). US2 (persistence)
landed with the foundation; US1 (browser flow) and US3 (DCR) with the routes; the race fix
finalized US1 robustness.

## Notes

- [P] tasks = different files, no dependencies.
- Test-first: `oauth-store.test.ts` (~7 OAuth CRUD tests) precedes `oauth-store.ts`.
- The OAuth contract is the MCP SDK `OAuthClientProvider` interface — no `contracts/` or
  `data-model.md` for this feature.
