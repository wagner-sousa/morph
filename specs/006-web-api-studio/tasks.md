---
description: "Task list for Web API & Morph Studio Dashboard (retroactive — all done)"
---

# Tasks: Web API & Morph Studio Dashboard

**Input**: Design documents from `/specs/006-web-api-studio/`

**Prerequisites**: plan.md, spec.md, contracts/rest-api.md

**Tests**: Included — `tests/unit/web-server.test.ts` (sibling test per Constitution III).

**Organization**: Grouped by user story; ordered by implementation chronology.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1–US5 per spec.md

## Path Conventions

Web application: backend in `src/web/`, frontend in `web-frontend/src/`, tests in `tests/unit/`.

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Scaffold Fastify web server in [src/web/server.ts](../../src/web/server.ts) (cors, multipart, websocket, static).
- [X] T002 Scaffold Morph Studio frontend in [web-frontend/](../../web-frontend) (Vite + React 19 + Tailwind v4 + shadcn/ui).
- [X] T003 [P] Configure dev proxy `/api` and `/ws` → `:3101` in [web-frontend/vite.config.ts](../../web-frontend/vite.config.ts).

---

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T004 Wire `WebServer` into the Hub coordinator in [src/hub.ts](../../src/hub.ts).
- [X] T005 Implement error handler + status-by-code mapping in [src/web/server.ts](../../src/web/server.ts).
- [X] T006 Implement optional HTTP Basic auth preHandler for `/api` and `/ws`.
- [X] T007 Bridge Hub events (logs/stats/health/config) to WebSocket broadcasts.
- [X] T008 Serve built SPA from `./public` with `index.html` fallback handler.
- [X] T009 [P] Add sibling unit test [tests/unit/web-server.test.ts](../../tests/unit/web-server.test.ts) (~14 cases, schema validation + route behavior).

**Checkpoint**: Foundation ready.

---

## Phase 3: User Story 1 - Manage backend MCPs (P1) 🎯 MVP

- [X] T010 [US1] Read endpoints: `GET /api/mcps`, `/api/mcps/:name`, `/api/mcps/:name/tools` in [src/web/server.ts](../../src/web/server.ts).
- [X] T011 [US1] `POST /api/mcps/:name/restart` (disconnect → connect).
- [X] T012 [US1] CRUD endpoints `POST/PUT/DELETE /api/mcps` reusing `MCPDefinitionSchema`, persisting via `hub.saveConfig` (commit `ceadc3d`).
- [X] T013 [P] [US1] MCP list/cards UI in [web-frontend/src/pages/Mcps.tsx](../../web-frontend/src/pages/Mcps.tsx) + [MCPCard.tsx](../../web-frontend/src/components/MCPCard.tsx).
- [X] T014 [US1] MCP edit form (commit `4384825`).

**Checkpoint**: MCP management fully functional.

---

## Phase 4: User Story 2 - Live logs & single-call inspection (P1)

- [X] T015 [US2] `GET /api/logs` with `mcp/level/since/limit` filters.
- [X] T016 [US2] DB columns `input_json`/`output_text` + `GET /api/logs/:id` detail (commit `e89b9a2`).
- [X] T017 [US2] Store TOON text + DB token counts surfaced in LogDetail (commit `b5a4fa7`).
- [X] T018 [US2] `GET /api/logs/stream` SSE fallback + `/ws` `logs` channel broadcast.
- [X] T019 [P] [US2] Live log UI in [web-frontend/src/pages/Logs.tsx](../../web-frontend/src/pages/Logs.tsx) + [LogStream.tsx](../../web-frontend/src/components/LogStream.tsx).
- [X] T020 [P] [US2] JSON-vs-TOON side-by-side + token savings in [web-frontend/src/pages/LogDetail.tsx](../../web-frontend/src/pages/LogDetail.tsx).

**Checkpoint**: Live observability + per-call inspection working.

---

## Phase 5: User Story 3 - Aggregate savings dashboard (P2)

- [X] T021 [US3] `GET /api/calls/totals` (windowed by `since`) and `GET /api/calls/totalizers` (commit `a22fe4d`).
- [X] T022 [US3] `GET /api/stats`, `/api/stats/toon`, `/api/stats/toon/history`.
- [X] T023 [P] [US3] Dashboard totalizer widgets in [web-frontend/src/pages/Dashboard.tsx](../../web-frontend/src/pages/Dashboard.tsx) + [TOONStats.tsx](../../web-frontend/src/components/TOONStats.tsx) and [Stats.tsx](../../web-frontend/src/pages/Stats.tsx).

**Checkpoint**: Aggregate savings visible.

---

## Phase 6: User Story 4 - Per-MCP tools with JSON/TOON toggle (P2)

- [X] T024 [US4] Per-MCP direct handler + `POST /api/mcp/:name` (commit `e2a6d65`).
- [X] T025 [P] [US4] Tools browser + JSON/TOON toggle in [web-frontend/src/components/MCPToolsModal.tsx](../../web-frontend/src/components/MCPToolsModal.tsx).

**Checkpoint**: Tool browsing with TOON preview working.

---

## Phase 7: User Story 5 - OAuth & settings (P3)

- [X] T026 [US5] OAuth routes `status/start/callback` in [src/web/oauth-routes.ts](../../src/web/oauth-routes.ts).
- [X] T027 [US5] Config endpoints `GET/PUT /api/config`, `POST /api/config/reload`, `POST /api/config/import` reusing `validateConfig`.
- [X] T028 [P] [US5] Settings page (commit `2650a70`) in [web-frontend/src/pages/Settings.tsx](../../web-frontend/src/pages/Settings.tsx).

**Checkpoint**: All user stories functional.

---

## Phase 8: Polish & Cross-Cutting

- [X] T029 [P] CORS lockdown (dev `:5173` / prod `CORS_ORIGIN`).
- [X] T030 `GET /api/version` and `GET /api/health` system endpoints.
- [X] T031 Optional `/mcp` HTTP JSON-RPC + SSE transport.
- [X] T032 [P] Document contracts in [contracts/rest-api.md](contracts/rest-api.md).

---

## Dependencies & Execution Order

- Setup (Phase 1) → Foundational (Phase 2) → user stories.
- US1 and US2 (both P1) are the MVP; US3/US4 (P2) and US5 (P3) follow.
- All write paths reuse the zod contracts in `src/config` (Constitution I).

## Notes

- All tasks complete (retroactive documentation).
- Commit references: `ceadc3d`, `e89b9a2`, `a22fe4d`, `e2a6d65`, `2650a70`, `4384825`, `b5a4fa7`.
