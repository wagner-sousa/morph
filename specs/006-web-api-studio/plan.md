# Implementation Plan: Web API & Morph Studio Dashboard

**Branch**: `006-web-api-studio` | **Date**: 2026-06-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/006-web-api-studio/spec.md`

## Summary

Provide a browser control plane for MORPH: a Fastify REST API plus a realtime WebSocket on
`:3101` that exposes backend-MCP management (CRUD + restart), live tool-call logs, single-call
JSON-vs-TOON inspection with token savings, aggregate totalizers, TOON stats/history, OAuth
flows, and config read/update. The backend also serves the built "Morph Studio" SPA (Vite +
React 19 + Tailwind v4 + shadcn/ui) from `./public`, with an `index.html` SPA fallback. All
state is owned by the Hub (registry, store, logs, metrics); the web server is a thin adapter
that wires Hub data and events to HTTP/WS. Tool results flow through the TOON converter so
JSON/TOON and savings stay consistent.

## Technical Context

**Language/Version**: Node 22, TypeScript (NodeNext, pure ESM)

**Primary Dependencies**: Backend — Fastify 5, `@fastify/cors`, `@fastify/multipart`,
`@fastify/websocket`, `@fastify/static`. Frontend — Vite 6, React 19, Tailwind CSS v4
(`@tailwindcss/vite`), shadcn/ui, `tailwind-merge`.

**Storage**: SQLite via Hub store (logs, call totals/totalizers, savings history); config in
`morph.json` + `.mcp.json`.

**Testing**: Vitest (`tests/unit/web-server.test.ts`).

**Target Platform**: Linux container (`node:22`); browser SPA.

**Project Type**: Web application (frontend + backend).

**Performance Goals**: Live log/stat updates pushed to clients within ~1s of the event.

**Constraints**: Logger output to stderr (stdio MCP safety); optional HTTP Basic auth on
`/api` and `/ws`; CORS locked to `:5173` in dev and `CORS_ORIGIN` in prod.

**Scale/Scope**: Single operator / small team; ~20 REST endpoints + one WebSocket; 6 SPA pages.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Contract-First (Zod)**: MCP create/edit reuse `MCPDefinitionSchema` and config
      updates reuse `validateConfig` from `src/config`; no schema duplication, no hand-edited
      `schema.json`/`mcp.schema.json`.
- [x] **II. SPEC vs IMPL**: `src/web/server.ts` carries an `IMPL:` header and consumes the
      existing Hub/config contracts; no new contract files introduced here.
- [x] **III. Test-First / one test per module**: the web server has its sibling
      [tests/unit/web-server.test.ts](../../tests/unit/web-server.test.ts) (~14 cases,
      schema validation and route behavior).
- [x] **IV. Docker-First / Pure ESM**: builds/tests run in `node:22`; intra-package imports
      use `.js`; logger writes to stderr; SPA built and served from `./public`.
- [x] **V. Token Savings**: per-call detail and totalizers surface TOON token counts; all
      results pass through the converter — no regression to savings.

No violations — Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/006-web-api-studio/
├── plan.md              # This file
├── spec.md
├── tasks.md
└── contracts/
    └── rest-api.md      # REST endpoints + WebSocket
```

(No `data-model.md`: this feature adds no new config schema; it reuses `src/config`.)

### Source Code (repository root)

```text
src/web/
├── server.ts            # Fastify app: REST routes, /ws, SSE, static SPA, auth, error handler
└── oauth-routes.ts      # /api/mcps/:name/oauth/{status,start,callback}

src/
├── hub.ts               # coordinator: registry, store, logs, metrics, config (wires WebServer)
├── config/schema.ts     # MCPDefinitionSchema (reused by CRUD)
└── config/loader.ts     # validateConfig (reused by PUT /api/config)

web-frontend/            # Morph Studio (Vite + React 19 + Tailwind v4 + shadcn/ui)
├── src/pages/           # Dashboard, Logs, LogDetail, Mcps, Settings, Stats
├── src/components/      # LogStream, MCPCard, MCPToolsModal, Sidebar, TOONStats, ui/
├── src/hooks/  src/lib/
└── vite.config.ts       # dev proxy: /api and /ws → http://localhost:3101

tests/unit/web-server.test.ts
```

**Structure Decision**: Web-application structure. Backend lives in [src/web/](../../src/web)
served by the Hub on `:3101`; the React SPA lives in [web-frontend/](../../web-frontend) and is
built into the backend's `./public`. In dev, Vite (`:5173`) proxies `/api` and `/ws` to the
backend per [web-frontend/vite.config.ts](../../web-frontend/vite.config.ts).

### Implementation history (commits)

- `ceadc3d` — CRUD API endpoints (`POST/PUT/DELETE /api/mcps`).
- `e89b9a2` — `input_json`/`output_text` columns + `GET /api/logs/:id`.
- `a22fe4d` — totalizers + Dashboard widget (`GET /api/calls/totalizers`).
- `e2a6d65` — per-MCP direct handler + `POST /api/mcp/:name`.
- `2650a70` — Settings page.
- `4384825` — MCP edit form.
- `b5a4fa7` — store TOON text, DB token counts in LogDetail.

## Complexity Tracking

No constitution violations; table intentionally empty.
