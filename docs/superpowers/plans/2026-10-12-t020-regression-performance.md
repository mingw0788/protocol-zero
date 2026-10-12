# T020 Regression, Performance and Stability Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to execute this plan task-by-task.

**Goal:** Produce honest, reproducible regression, browser compatibility, long-session and high-density performance evidence for the implemented V1 game.

**Architecture:** Exercise the existing application and fixed-step systems without changing gameplay. Use automation for repeatable deterministic scenarios, actual Chromium/Edge pages for UI lifecycle, and direct Canvas frame timing for dense-render workloads. Record natural-run limits separately from controlled simulation.

**Tech Stack:** Existing Vitest, Vite, Playwright CLI/Chromium and installed Windows browsers only; no dependency installation.

**Scope source:** `docs/development-plan.md` T020; SRS FR-001–FR-018 and NFR-001–NFR-010.

## Global Constraints

- Do not change confirmed game rules or tune SRS values during verification.
- Do not install dependencies or add unrequested test frameworks.
- Distinguish natural play, controlled simulation and renderer stress measurements.
- Report actual measured FPS/timing and platform gaps; do not claim unmeasured compatibility or performance.
- Keep local test saves and generated browser artifacts out of tracked files.

## Review Focus

1. State/UI transitions and focus stay valid across MENU, PLAYING, PAUSED, LEVEL_UP, VICTORY and DEFEAT.
2. Visibility loss, restoration, resize and repeated restart do not advance hidden time or leak listeners/entities.
3. Versioned storage, audio context, event subscriptions and particle/entity collections stay bounded or safely degrade.
4. A controlled full-duration/boss path stays consistent with the 270/300-second boundaries and death priority.
5. Dense Canvas timing is measured on the target browser; unsupported measurements remain explicitly unverified.

### Task 1: Automated regression baseline

**Files:** tests only if a concrete regression is found; task report/status/docs.

- [ ] Inventory FR-001–FR-018 and NFR-001–NFR-010 against existing tests and T005–T019 evidence; list true coverage gaps.
- [ ] Run full `npm test`, `npm run build`, and `git diff --check`; preserve exact results.
- [ ] If a defect appears, add the narrowest regression test first, fix only in-scope behavior, then rerun affected and full verification.

### Task 2: Browser lifecycle and full-run scenarios

**Files:** tests only if required; task report/browser artifacts remain ignored.

- [ ] Run the current build in Chromium; check start/help/mute/volume, active battle/HUD, upgrades, pause/return confirmation, results/restart, saved progress refresh and malformed-save fallback.
- [ ] Check window visibility loss/restoration, repeated resize and at least three restart cycles; inspect UI/console and storage side effects.
- [ ] Locate and run installed Microsoft Edge if available. Record exact browser version and skipped cases if no executable/runtime is available.
- [ ] Attempt a normal-input five-minute playthrough; separately run controlled fixed-step boundary scenarios if survival or wall-clock constraints prevent a natural clear. Never label controlled time as natural play.

### Task 3: High-density rendering and object stability

- [ ] Render a repeatable 100-normal-enemy view with Boss, crystals, projectiles and capped particles using the real Canvas renderer.
- [ ] Warm up and collect frame-draw duration samples; report median/p95, equivalent throughput and runtime/device conditions.
- [ ] Run repeated GameWorld reset/restart and entity expiry under load; verify arrays/listeners/counts remain bounded and no console errors occur.
- [ ] Optimize only a demonstrated regression without changing simulation or gameplay rules; add a focused test and repeat measurements.

### Task 4: Acceptance report and project baseline

- [ ] Update SRS acceptance marks only where evidence satisfies the item; leave unsupported platform/performance claims open with reason.
- [ ] Update architecture, D-016/decision backlog if new evidence changes it, development plan, task status and T020 report.
- [ ] Commit `docs: record T020 regression and performance acceptance` after final verification.

## Expected evidence

- Exact test files/cases and build output.
- Browser names/versions, viewport, actions, console errors/warnings and storage/network observations.
- Natural play duration/outcome; controlled boundary result clearly separated.
- Stress population, iteration count, median/p95 draw times and whether the 16.67 ms frame target was met.
- Defect list with every unresolved item and its reason.
