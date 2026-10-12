# T021 Release and Delivery Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to execute this plan task-by-task.

**Goal:** Deliver a verified V1 static build, accurate operator documentation and a playable hosted URL without changing game rules or publishing the source repository.

**Architecture:** Keep the Vite app as a static client with no server or account dependency. Validate `dist/` locally, use the available static hosting integration for the built artifact, and create the V1 tag only after the deployed URL has been checked.

**Tech Stack:** Existing Vite 8, native JavaScript modules, Vitest 5, current installed browser tooling, configured static hosting integration; no dependency installation.

**Spec:** `docs/development-plan.md` T021, `docs/requirements.md` §§1, 7.2 and 13, `docs/architecture.md`, `docs/task-report-T020.md`.

## Global Constraints

- Preserve all confirmed V1 gameplay rules and configuration values.
- Do not install or add project dependencies.
- Do not publish the project source repository; deploy the production static output only.
- No paid APIs, game backend, login or account requirements.
- Assets are original in-repository code pixel patterns and synthesized Web Audio; no third-party runtime assets are used.
- Document the T020 natural-run and performance limitations honestly.
- The `v1.0.0` tag must identify the exact verified final source commit.

## Review Focus

1. README describes the current game and commands rather than stale T012 state.
2. Vite production output contains only local app assets and works at its hosted base path.
3. Deployment uses the exact tested source commit/build and doesn't expose the full source repository.
4. Hosted menu, start, movement, pause, restart and terminal UI can load with no development-server dependency.
5. License, browser compatibility, natural-run limitation and release version claims match recorded evidence.

### Task 1: Release documentation

**Files:** `README.md`, `docs/task-report-T021.md` (initial release checklist), `docs/task-status.md` after verification.

**Interfaces:**

- Consumes: SRS and architecture; T017 original-code art/audio approach; T020 validation and known limitations.
- Produces: accurate V1 setup/control/feature/support/limitation/license notes for maintainers and players.

- [ ] Replace obsolete README phase/feature claims with current V1 behavior, prerequisites, `npm ci`, dev/test/build/preview commands, controls and storage rules.
- [ ] Document compatibility versions and measured/untested boundaries without claiming a natural 5-minute win or full-frame FPS guarantee.
- [ ] State that included visual/audio assets are original code patterns/synthesized Web Audio and no external asset license is required.
- [ ] Review links, command names, file paths and status against actual repo contents.

### Task 2: Static artifact and hosted verification

**Files:** `.openai/hosting.json` if using Sites; Vite configuration only if the host path requires a correction; `docs/task-report-T021.md`.

**Interfaces:**

- Consumes: Vite `npm run build` output in `dist/`, existing `index.html`, `src/main.js`, CSS and localStorage behavior.
- Produces: a deployment whose `index.html` and built assets load from a static URL without a development server or external game APIs.

- [ ] Build from the final documentation/code source and inspect generated HTML, asset references, output size and absence of external runtime requests.
- [ ] Verify the production artifact through `npm run preview` in Chrome and Edge; cover MENU, help/settings, PLAYING/HUD, pause/resume, one terminal result/restart fixture, and persisted settings.
- [ ] Publish the static artifact using the available host. Keep source access private; use the project's requested shareable playable-site audience for the built page.
- [ ] Confirm terminal deployment success and open the exact production URL; record browser/version, console and resource evidence.
- [ ] If host credentials/publishing are unavailable, preserve a complete local `dist/` and report the exact deployment boundary without overstating online acceptance.

### Task 3: Final acceptance and V1 tag

**Files:** `docs/task-report-T021.md`, `docs/task-status.md`, `docs/requirements.md`, `docs/development-plan.md`; Git tag `v1.0.0`.

- [ ] Re-run `npm test`, `npm run build`, and `git diff --check` after final changes.
- [ ] Update T021/SRS release checks only with production-host evidence that was actually observed.
- [ ] Commit the verified T021 release record; create annotated `v1.0.0` at that exact commit.
- [ ] Verify the tag target, clean worktree and final production URL/status.

## Verification Contract

- Automated baseline: 50 test files / 395 tests; production build: 60 transformed modules at T020. Repeat after final docs and any required static-path adjustment.
- Browser verification must use the production preview or production URL, not the Vite development server.
- Distinguish forced UI fixtures from natural play and do not call a fixture a complete natural run.
- Record exact output URL, output commit/tag, browser versions and any remaining limitation in `docs/task-report-T021.md`.
