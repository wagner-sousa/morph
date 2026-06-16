# Feature Specification: OAuth Support for Backend MCP Servers

**Feature Branch**: `002-oauth-support`

**Created**: 2026-06-16

**Status**: Implemented

**Input**: User description: "Let operators connect backend MCP servers that require OAuth authorization, completed through a browser flow, with tokens that survive gateway restarts."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Authorize an OAuth-protected backend MCP via the browser (Priority: P1)

An operator configures a backend MCP server that requires OAuth. The gateway cannot
connect until the operator grants access. From the dashboard the operator starts the
authorization flow, is sent to the provider's consent screen in the browser, approves,
and is redirected back. The gateway exchanges the authorization code, stores the access
token, and reconnects so the backend's tools become available.

**Why this priority**: Without this, any OAuth-protected backend is permanently
unreachable. It is the core capability the feature exists to deliver.

**Independent Test**: Configure a backend that demands OAuth, trigger the start flow,
complete consent in a browser, and confirm the gateway reports the backend as authorized
and exposes its tools.

**Acceptance Scenarios**:

1. **Given** a configured backend MCP that requires OAuth and has no stored token,
   **When** the operator requests its authorization status,
   **Then** the gateway reports that authorization is needed and is not yet authorized.
2. **Given** that backend, **When** the operator starts the OAuth flow,
   **Then** the gateway returns the provider's authorization URL for the browser.
3. **Given** the operator approves consent and the provider redirects back with an
   authorization code, **When** the gateway receives the callback,
   **Then** it exchanges the code for tokens, reconnects the backend, and signals success
   to the page that opened the flow.
4. **Given** the operator denies consent or the provider returns an error,
   **When** the gateway receives the callback,
   **Then** it reports the denial/error to the originating page and stores no token.

### User Story 2 - Tokens persist across gateway restarts (Priority: P2)

After an operator has authorized a backend, the granted credentials remain valid after the
gateway process restarts, so the operator does not have to re-authorize on every restart.

**Why this priority**: Re-authorizing on each restart would make the gateway impractical to
operate, but it depends on US1 having produced a token first.

**Independent Test**: Authorize a backend, restart the gateway, and confirm the backend
still reports as authorized and connects without a new browser flow.

**Acceptance Scenarios**:

1. **Given** a backend that was authorized in a previous run, **When** the gateway starts,
   **Then** it loads the persisted credentials and treats the backend as authorized.
2. **Given** a persisted token, **When** the operator queries authorization status,
   **Then** the gateway reports the backend as already authorized and skips the flow.

### User Story 3 - Zero-config client onboarding via Dynamic Client Registration (Priority: P3)

An operator can connect to a provider that supports Dynamic Client Registration without
manually creating an OAuth client or pasting a client id/secret; the gateway registers
itself with the provider on first use and reuses that registration thereafter.

**Why this priority**: Improves onboarding ergonomics but is not required when a provider
issues static client credentials.

**Independent Test**: Point the gateway at a DCR-capable provider with no pre-created
client, run the flow, and confirm authorization succeeds and the registration is reused on
the next run.

**Acceptance Scenarios**:

1. **Given** a provider supporting DCR and no stored client registration, **When** the
   flow runs, **Then** the gateway registers a client and persists the registration.
2. **Given** a stored client registration, **When** the flow runs again,
   **Then** the gateway reuses it rather than registering a new client.

### Edge Cases

- The callback arrives with an error or without a code → the originating page is told the
  attempt was denied/failed and no token is saved.
- The provider redirects faster than the gateway begins waiting for the redirect URL → the
  pending authorization URL is captured and not lost (no race).
- A backend has no OAuth provider configured but a start request arrives → the gateway
  rejects the request as OAuth-not-available.
- Authorization is requested for a backend name that does not exist → not-found is
  returned.
- The operator revokes/invalidates stored credentials → subsequent connections require a
  fresh flow.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The gateway MUST detect when a configured backend MCP requires OAuth
  authorization before it can connect.
- **FR-002**: The gateway MUST expose the current authorization status of each backend,
  including whether authorization is needed, whether a token is held, and the pending
  authorization URL when one exists.
- **FR-003**: The gateway MUST initiate an OAuth authorization flow on operator request and
  return a browser authorization URL.
- **FR-004**: The authorization flow MUST use PKCE, generating and retaining a code
  verifier for the subsequent token exchange.
- **FR-005**: The gateway MUST handle the provider's redirect callback, exchanging the
  authorization code for tokens and reporting outcome (success, denied, error) to the page
  that opened the flow.
- **FR-006**: On successful authorization the gateway MUST reconnect the backend so its
  tools become available.
- **FR-007**: The gateway MUST persist tokens, client registrations, code verifiers, and
  discovery metadata so they survive process restarts.
- **FR-008**: The gateway MUST support Dynamic Client Registration, persisting and reusing
  any client registration it obtains.
- **FR-009**: The gateway MUST skip the authorization flow for a backend that already holds
  a valid token, reporting it as already authorized.
- **FR-010**: The gateway MUST be able to invalidate stored credentials (all, tokens,
  client, verifier, or discovery state) so a fresh flow can be performed.
- **FR-011**: The redirect/callback URL the gateway advertises MUST derive from an operator-
  configurable public base URL so the flow works behind a known external address.

### Key Entities *(include if feature involves data)*

- **OAuth Session**: The full per-backend authorization record, keyed by backend MCP name.
  Holds tokens, client registration, code verifier, pending authorization URL, and
  discovery metadata. Persisted as a whole so it can be reloaded after restart.
- **OAuth Token Set**: The credentials granted by the provider (access token and any
  refresh/expiry data) used to authenticate the backend connection.
- **Client Registration**: The OAuth client identity the gateway presents to the provider —
  either provided statically or obtained via Dynamic Client Registration — reused across
  flows.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An operator can take an OAuth-protected backend from "not authorized" to
  "tools available" entirely through the browser flow, with no manual token entry.
- **SC-002**: After authorization, a gateway restart requires zero re-authorization: the
  backend reports authorized 100% of the time when valid persisted credentials exist.
- **SC-003**: A provider redirect that occurs before the gateway begins waiting for it is
  captured 100% of the time (no lost-redirect race).
- **SC-004**: A denied or errored authorization never results in a stored token and is
  reported back to the operator's page.
- **SC-005**: For DCR-capable providers, the operator completes onboarding without
  pre-creating an OAuth client.

## Assumptions

- The operator has browser access to complete interactive consent.
- The gateway's public base URL is reachable by the OAuth provider for the redirect.
- Providers follow standard OAuth 2.0 with PKCE; DCR is used only when the provider
  supports it.
- The existing dashboard/web layer is reused to drive the flow and display status.
