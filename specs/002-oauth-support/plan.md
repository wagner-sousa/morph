# Implementation Plan: OAuth Support for Backend MCP Servers

**Branch**: `002-oauth-support` | **Date**: 2026-06-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-oauth-support/spec.md`

## Summary

Enable MORPH to connect to backend MCP servers that require OAuth. The gateway implements
the MCP SDK's `OAuthClientProvider` so the SDK drives an OAuth 2.0 + PKCE flow, including
Dynamic Client Registration when the provider supports it. A persistent store keeps the
per-backend session (tokens, client registration, code verifier, pending authorization URL,
discovery metadata) on disk so authorization survives restarts. Web routes let an operator
query status, start the flow (obtaining a browser authorization URL), and handle the
provider's redirect callback, after which the backend reconnects and its tools become
available. The advertised redirect URL derives from a configurable public base URL.

## Technical Context

**Language/Version**: TypeScript (ESM, `NodeNext`) on Node 22

**Primary Dependencies**: `@modelcontextprotocol/sdk` (`OAuthClientProvider`,
`OAuthClientInformationMixed`, `OAuthTokens`, `OAuthDiscoveryState`); Fastify for web routes

**Storage**: JSON file `oauth-sessions.json` under the gateway data directory (one record
per backend MCP name)

**Testing**: Vitest (`tests/unit/oauth-store.test.ts`)

**Target Platform**: Linux server / `node:22` container

**Project Type**: Single project (web-service gateway)

**Performance Goals**: Interactive flow latency bounded by the external provider; persisted
sessions load once at startup

**Constraints**: Pure ESM with explicit `.js` imports; logs to stderr; must not lose a
provider redirect that arrives before the gateway waits for it

**Scale/Scope**: One OAuth session per configured backend MCP

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Confirm the plan complies with the MORPH Constitution (`.specify/memory/constitution.md`):

- [x] **I. Contract-First (Zod)**: The only configuration touched is `publicUrl`, added to
      the zod schema in `src/config/schema.ts`; types remain `z.infer`-derived and schemas
      regenerated via `npm run gen:schema`. No hand-edited `schema.json`.
- [x] **II. SPEC vs IMPL**: OAuth source files carry the correct `SPEC:`/`IMPL:` headers;
      the SDK `OAuthClientProvider` interface is the contract the provider implements.
- [x] **III. Test-First / one test per module**: `tests/unit/oauth-store.test.ts` covers the
      store module's CRUD behavior, the sibling test for the new persistence module.
- [x] **IV. Docker-First / Pure ESM**: All imports use explicit `.js` extensions; logging
      goes through the hub logger to stderr; everything runs under `node:22`.
- [x] **V. Token Savings**: No change to TOON conversion; backend tool results continue to
      flow through the converter once the authorized connection is established.

All boxes pass; no entries required in Complexity Tracking.

## Key Design Decision: OAuth provider redirect race fix

`MorphOAuthProvider` bridges two SDK calls that can fire in either order:
`redirectToAuthorization(url)` (the SDK hands us the authorization URL) and
`waitForRedirect()` (our code awaits that URL). If `redirectToAuthorization` ran *before*
`waitForRedirect`, the resolver would not yet exist and the URL would be lost.

The fix (commit `90e69e5`) stores the URL in a `pendingUrl` field as soon as
`redirectToAuthorization` is called, and `waitForRedirect` checks that field before creating
a new Promise — resolving immediately if the URL already arrived, otherwise installing the
resolver for `redirectToAuthorization` to call later. This makes the handshake order-
independent and prevents the lost-redirect race (FR-005, SC-003). See
[src/mcp-client/oauth-provider.ts](../../src/mcp-client/oauth-provider.ts)
(`redirectToAuthorization` / `waitForRedirect`).

## Project Structure

### Documentation (this feature)

```text
specs/002-oauth-support/
├── plan.md              # This file
├── spec.md              # Feature specification
└── tasks.md             # Task breakdown
```

No `contracts/` or `data-model.md`: the OAuth contract is the MCP SDK's
`OAuthClientProvider` interface, and the only config change is a single `publicUrl` field.

### Source Code (repository root)

```text
src/
├── mcp-client/
│   ├── oauth-provider.ts   # MorphOAuthProvider (implements SDK OAuthClientProvider; PKCE, DCR, redirect bridge)
│   └── oauth-store.ts      # OAuthStore (persistent per-backend session store)
├── web/
│   └── oauth-routes.ts     # status / start / callback Fastify routes
└── config/
    └── schema.ts           # publicUrl field (zod)

tests/
└── unit/
    └── oauth-store.test.ts # OAuth store CRUD tests
```

**Structure Decision**: Single-project gateway layout. OAuth logic lives with the MCP
client (`src/mcp-client/`) since it governs backend connections; HTTP entry points live with
the web layer (`src/web/`); the registry wires the provider per backend and the hub
coordinates. Real files:

- [src/mcp-client/oauth-provider.ts](../../src/mcp-client/oauth-provider.ts)
- [src/mcp-client/oauth-store.ts](../../src/mcp-client/oauth-store.ts)
- [src/web/oauth-routes.ts](../../src/web/oauth-routes.ts)
- [tests/unit/oauth-store.test.ts](../../tests/unit/oauth-store.test.ts)

## Complexity Tracking

> No constitution violations; table intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| —         | —          | —                                    |
