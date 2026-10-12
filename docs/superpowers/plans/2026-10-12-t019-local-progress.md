# T019 Implementation Plan

**Goal:** Safely persist local run records and audio preferences with a versioned schema, and show saved records in the main menu.

**Spec:** `docs/superpowers/specs/2026-10-12-t019-local-progress-design.md`

## Task 1: Versioned storage adapter

- [ ] Write storage tests for missing/corrupt/unsupported records, validation, and throwing storage APIs.
- [ ] Run focused tests red.
- [ ] Implement immutable save schema defaults and exception-safe `LocalProgressStore`.
- [ ] Run focused tests green and commit `feat: add versioned local progress storage`.

## Task 2: Progress decisions and Game integration

- [ ] Write tests for best-record update rules and Game audio preference/terminal-result persistence.
- [ ] Implement `LocalProgressSystem`; load once, persist settings, update records only from accepted terminal snapshots.
- [ ] Connect it to Game and audio settings; keep storage errors outside gameplay failure paths.
- [ ] Run focused tests and commit `feat: persist run records and audio preferences`.

## Task 3: Menu presentation and acceptance

- [ ] Add compact semantic high-kill/best-clear display to the main menu; test empty/saved values and narrow layout.
- [ ] Run `npm test`, `npm run build`, `git diff --check`; browser-check refresh, repeated runs, and corrupt storage fallback.
- [ ] Update SRS, architecture, decision D-016, plan and status; create report; commit `docs: record T019 persistence acceptance`.

## Constraints

- Do not persist in-progress run state or change victory/defeat rules.
- Local storage failures must not throw into app startup, audio controls, or simulation.
- No new dependencies or server/cloud service.
