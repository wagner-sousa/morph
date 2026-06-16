---
description: "Task list for Docker-First Build, Dev Stack & CI/CD"
---

# Tasks: Docker-First Build, Dev Stack & CI/CD

**Input**: Design documents from `/specs/010-docker-ci/`

**Prerequisites**: plan.md (required), spec.md (required for user stories)

**Tests**: No new application module is added, so no per-module unit test is created here.
Verification runs the existing suite in a clean container and relies on the CI workflows as
the gate (see Phase 5).

**Organization**: Tasks are grouped by user story and ordered by implementation chronology
(commits `faaf0eb` → `98af691` → `ac1fe9e` → `89ac4e5` → `ac01f5e` → `9232f57`).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project skeleton enabling a Docker-first workflow

- [X] T001 Scaffold the ESM Node 22 project (`package.json` with build/test/typecheck/
      gen:schema scripts, TypeScript `NodeNext`, Vitest config) — commit `faaf0eb`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The build artifacts everything else depends on

**⚠️ CRITICAL**: No CI/release work can begin until the image and Compose files exist

- [X] T002 [US1] Author multi-stage `Dockerfile` (frontend build → backend build + dev-dep
      prune → lean `node:22` runtime with healthcheck and stdio-default transport) — `faaf0eb`

**Checkpoint**: Production image buildable in a clean container

---

## Phase 3: User Story 1 - Run everything in Docker, no local toolchain (Priority: P1) 🎯 MVP

**Goal**: Build/test/run the whole system in `node:22` with no host toolchain.

**Independent Test**: On a Docker-only host, `docker compose -f docker-compose.dev.yml up`
brings up backend, Studio, and demo MCPs; `docker compose build` produces the prod image.

- [X] T003 [US1] Author `docker-compose.yml` (production: build context, `env_file`,
      `./data` mount, HTTP transport, restart policy, healthcheck-aware) — `faaf0eb`
- [X] T004 [US1] Author `docker-compose.dev.yml` hot-reload stack — backend `:3101`,
      `morph-studio` `:5173`, `mcp-test-servers` `:3200-3202` with mounted source and shared
      `node_modules` volumes — `faaf0eb`
- [X] T005 [US1] Full env parametrization (`MORPH_CONFIG`, `MORPH_DATA_DIR`,
      `MORPH_TRANSPORT`, etc.) and consolidation onto a single `./data` folder; document via
      `.env.example` — `ac01f5e`

**Checkpoint**: Whole stack runs in Docker; production image runnable, env-driven

---

## Phase 4: User Story 2 - Pushes to main are automatically validated and shipped (Priority: P2)

**Goal**: Ordered CI gates and automatic GHCR image publication.

**Independent Test**: Push/PR to `main`; confirm staged jobs run in order and an image is
pushed only when all gates pass.

- [X] T006 [US2] Author `ci.yml` with ordered jobs typecheck → test → build (backend +
      frontend), each `needs:` the prior — commit `98af691`
- [X] T007 [US2] Author `docker.yml`: Buildx/QEMU, GHCR login, metadata tags
      (branch/short-SHA/semver/latest), build & push with GHA cache — `98af691`
- [X] T008 [US2] Add the `lint` & `format:check` job (backend + frontend) as the first gate
      so typecheck `needs: [lint]` — commit `89ac4e5`

**Checkpoint**: main is continuously linted, type-checked, tested, built, and shipped

---

## Phase 5: User Story 3 - Releases are versioned automatically (Priority: P3)

**Goal**: Conventional-Commit-driven versioning, changelog, and versioned image.

**Independent Test**: Land a `feat:`/`fix:` commit on `main`; confirm a new tag, CHANGELOG
entry, and versioned `latest` image.

- [X] T009 [US3] Add `.releaserc.json` + semantic-release plugins: derive version from
      Conventional Commits, prepend CHANGELOG, sync `web-frontend/package.json`, push
      `vX.Y.Z` tag (via `RELEASE_TOKEN` so the tag triggers Docker) — commit `ac1fe9e`
- [X] T010 [US3] Wire `docker.yml` to react to `v*` tags and publish `{{version}}`,
      `{{major}}.{{minor}}`, and `latest` images — `ac1fe9e`

**Checkpoint**: Releases fully automated; tags drive versioned images

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T011 Author `docs.yml` to build (MkDocs `--strict`) and deploy the docs site to
      GitHub Pages on docs changes, independent of app CI
- [X] T012 Remove the obsolete standalone release workflow after consolidating release into
      semantic-release — commit `9232f57`
- [X] T013 Verification: run the suite in a clean container —
      `docker run --rm -v "$PWD":/app -w /app node:22 sh -c "npm install && npm test"` —
      and confirm the `ci.yml` lint → typecheck → test → build gates pass as the CI gate

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup — the Dockerfile blocks all downstream work.
- **US1 (Phase 3)**: Depends on the image existing (Phase 2).
- **US2 (Phase 4)**: Depends on US1 — CI builds and ships the Docker artifact from US1.
- **US3 (Phase 5)**: Depends on US2 — release tags drive the existing Docker workflow.
- **Polish (Phase 6)**: Depends on the pipeline being in place.

### Within Each User Story

- Build artifacts (Dockerfile, Compose) before the CI that consumes them.
- CI gates before release automation that builds on them.

### Parallel Opportunities

- The docs workflow (T011) is independent of the application CI and could be authored in
  parallel with Phases 4–5.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Setup + Foundational (Dockerfile).
2. Complete US1 (Compose stacks + env/`./data` consolidation).
3. **STOP and VALIDATE**: run the full stack and the test suite in clean containers.

### Incremental Delivery

1. Docker build/run (US1, MVP) → 2. Automated validation + GHCR push (US2) →
3. Automated versioning (US3) → 4. Docs deploy + cleanup (Polish).

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps each task to its user story for traceability.
- All tasks complete — this is retroactive documentation of shipped work.
