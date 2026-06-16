# Implementation Plan: Docker-First Build, Dev Stack & CI/CD

**Branch**: `010-docker-ci` | **Date**: 2026-06-16 | **Spec**: [spec.md](spec.md)

**Note**: Retroactive plan documenting an already-implemented feature.

## Summary

Package MORPH so the entire system — gateway backend, Morph Studio, and demo MCP servers —
builds, tests, and runs inside `node:22` containers with no local Node toolchain, and ship
it automatically. A multi-stage `Dockerfile` produces a lean production runtime image; two
Compose files cover production (`docker-compose.yml`) and a hot-reload dev stack
(`docker-compose.dev.yml`). GitHub Actions runs ordered gates (lint/format → typecheck →
test → build) and, on `main`/tags, builds and pushes a GHCR image; semantic-release
automates versioning, changelog, and version tags from Conventional Commits. Runtime is
fully env-parametrized with a single `./data` folder for persistent state.

## Technical Context

**Language/Version**: Node.js 22 (pure ESM), TypeScript `NodeNext`

**Primary Dependencies**: Docker multi-stage build, Docker Compose, GitHub Actions
(docker/setup-buildx, docker/metadata-action, build-push-action), semantic-release
(+ changelog/npm/exec/git/github plugins), Vite (Morph Studio), better-sqlite3 (savings
history)

**Storage**: SQLite savings history under a single mounted `./data` folder
(`MORPH_DATA_DIR`)

**Testing**: Vitest, executed in a clean `node:22` container; the CI `test` job is the gate

**Target Platform**: Linux container (`node:22-bookworm` / `-slim`), GHCR-hosted image

**Project Type**: Web service (backend gateway) + frontend (Morph Studio) + CI/CD tooling

**Performance Goals**: Lean runtime image (dev-deps pruned, slim base); fast-failing CI
(cheapest gate first); cached Docker builds via GHA cache

**Constraints**: No host Node toolchain assumed; logs to stderr (stdio MCP safety); all
runtime config via environment variables; single writable `./data` mount

**Scale/Scope**: Single image + 3-service dev stack + 3 CI workflows (CI, Docker, Docs)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Confirm the plan complies with the MORPH Constitution (`.specify/memory/constitution.md`):

- [x] **I. Contract-First (Zod)**: This feature is build/CI tooling and does not change
      configuration schemas; `src/config/schema.ts` and the generated `schema.json` /
      `mcp.schema.json` are untouched. Env parametrization passes values to existing config,
      not new hand-written types.
- [x] **II. SPEC vs IMPL**: No `src/` source files added; the Dockerfile, Compose files, and
      workflows are infrastructure, not SPEC/IMPL-tagged modules. No contracts precede
      missing implementations.
- [x] **III. Test-First / one test per module**: No application module is added, so no new
      `tests/unit/<module>.test.ts` is required. Instead this feature *operationalizes* the
      test gate — the existing suite runs in CI (and in a clean container) as the
      verification mechanism.
- [x] **IV. Docker-First / Pure ESM** *(centerpiece)*: Every build/test/codegen step runs in
      `node:22`; the production image is multi-stage `node:22`, the dev stack and ad-hoc test
      runs use `node:22`, and CI uses Node 22. The project stays pure ESM and logger output
      remains on stderr so stdio MCP framing is never corrupted. This feature is the literal
      realization of Principle IV.
- [x] **V. Token Savings**: No change to TOON conversion or savings; the converter and
      SQLite savings history are unaffected (the `./data` consolidation merely relocates the
      same persistent state).

All boxes pass — no Complexity Tracking entries required.

## Project Structure

### Documentation (this feature)

```text
specs/010-docker-ci/
├── plan.md   # This file
├── spec.md   # Feature specification (Implemented)
└── tasks.md  # Task list (all complete)
```

No `contracts/` or `data-model.md`: this feature adds no configuration contract.

### Source Code (repository root)

```text
Dockerfile                       # multi-stage: frontend → backend (prune) → runtime
docker-compose.yml               # production: env_file, ./data mount, HTTP transport
docker-compose.dev.yml           # dev stack: backend :3101, Studio :5173, demo MCPs :3200-3202
.env.example                     # documented env parametrization
.github/workflows/
├── ci.yml                       # lint/format → typecheck → test → build (backend+frontend)
├── docker.yml                   # build & push image to GHCR (branch/sha/semver/latest)
└── docs.yml                     # build & deploy MkDocs site to GitHub Pages
.releaserc.json                  # semantic-release config (changelog, tag, version sync)
```

**Structure Decision**: Web service + frontend + CI/CD tooling. The realized artifacts are
[Dockerfile](../../Dockerfile), [docker-compose.yml](../../docker-compose.yml),
[docker-compose.dev.yml](../../docker-compose.dev.yml), and the workflows under
[.github/workflows/](../../.github/workflows/) (`ci.yml`, `docker.yml`, `docs.yml`).

### Implementation history (commits)

- `faaf0eb` — project scaffolding + multi-stage Dockerfile and prod/dev Compose files.
- `98af691` — GitHub Actions workflows: `ci.yml` (typecheck → test → build) and `docker.yml`
  (build & push to GHCR on main/tags).
- `ac1fe9e` — semantic-release automation: versioning, changelog, frontend version sync, and
  `vX.Y.Z` tag that triggers the versioned image build.
- `89ac4e5` — lint & format job added as the first gate of the CI pipeline.
- `ac01f5e` — full env parametrization and consolidation onto a single `./data` folder.
- `9232f57` — removed the obsolete standalone release workflow after consolidation.

## Complexity Tracking

> No Constitution Check violations — table intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
