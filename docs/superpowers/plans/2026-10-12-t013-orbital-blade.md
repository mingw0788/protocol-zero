# T013 Orbital Blade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement UP-04 orbital blade unlock/upgrades, per-enemy contact cooldown, shared damage, visible rendering, and truthful HUD state.

**Architecture:** `OrbitalBladeSystem` owns angle and per-enemy cooldowns while consuming frozen upgrade effects and the shared `EnemyDamageSystem`. `GameWorld` updates it before existing death settlement and derives the equipped HUD ID from UP-04; Canvas and DOM views consume immutable snapshots.

**Tech Stack:** Native JavaScript ES modules, Canvas 2D, Vitest, Vite; no new project dependencies.

**Spec:** `docs/superpowers/specs/2026-10-12-t013-orbital-blade-design.md`

## Global Constraints

- Keep SRS V1 scope: one starting pulse gun, one UP-04 orbital blade, six upgrades, one player, one map; do not add V2/V3 features.
- Keep the 1/60 second fixed simulation step; MENU, PAUSED, LEVEL_UP, and player death do not advance weapon behavior.
- Keep shared weapon base configuration immutable; use `damageMultiplier` from `GameWorld.getUpgradeEffectSnapshot()`.
- Use shared `EnemyDamageSystem`; GameWorld remains the only owner of enemy death, kill count, and experience settlement.
- Do not install dependencies or change confirmed gameplay. Orbital first-run values are configurable tuning baselines from the T013 spec.
- Verify with automated tests, production build, and browser evidence; report any browser path not reached as unverified.

## Review Focus

- Invalid level/effect/delta/config inputs leave angle, cooldowns, and enemies unchanged: test in `tests/orbital-blade-system.test.js`.
- Enemy death/removal and later ID reuse cannot inherit an old hit cooldown: test dead and absent ID cleanup in `tests/orbital-blade-system.test.js`.
- Same-step kills from both weapons notify once and create one crystal: test ordering/idempotence in `tests/game-world-orbital-blade.test.js`.
- LEVEL_UP, pause, and death freeze angle/cooldown/HP: integration tests in `tests/game-world-orbital-blade.test.js`.
- Locked, unlocked, and reset HUD/icon states and offscreen drawing stay consistent: tests in `tests/ui-manager.test.js`, `tests/orbital-blade-renderer.test.js`, and `tests/enemy-renderer.test.js`.

---

### Task 1: OrbitalBladeSystem

**Files:**
- Create: `src/config/orbitalBladeConfig.js`
- Create: `src/systems/OrbitalBladeSystem.js`
- Create: `tests/orbital-blade-system.test.js`

**Interfaces:**
- Consumes: `{ orbitalBladeLevel, damageMultiplier }` from the existing frozen upgrade-effect snapshot; shared Player, enemy array, and `EnemyDamageSystem.applyDamage(enemy, damage)`.
- Produces: `update({ deltaSeconds, upgradeEffects })`, `getSnapshot(level = lastSimulatedLevel)`, and `reset()`; immutable snapshot `{ active, level, playerX, playerY, x, y, radius, orbitRadius, angleRadians, color }`. Explicit level is display-only; `GameWorld` passes the current UpgradeSystem rank so the render snapshot updates immediately after a choice.

- [x] **Step 1: Write failing tests** for locked state, configured orbit and damage, per-target cooldown and cleanup, reset/configuration isolation, invalid inputs, and rejection of validated configuration replacement.
- [x] **Step 2: Run `npm test -- tests/orbital-blade-system.test.js` and observe the expected missing-module/API failures.**
- [x] **Step 3: Add frozen `ORBITAL_BLADE_CONFIG` and implement the validated system with the exact values and formulas in the spec.**
- [x] **Step 4: Re-run the focused tests; expect all named cases to pass and the injected config object to remain unchanged.**
- [x] **Step 5: Commit the configuration, system, and tests as `feat: add orbital blade combat system`.**

### Task 2: GameWorld and upgrade integration

**Files:**
- Modify: `src/core/GameWorld.js`
- Create: `tests/game-world-orbital-blade.test.js`

**Interfaces:**
- Consumes: Task 1 `OrbitalBladeSystem`; existing `chooseUpgrade`, `UpgradeEffectSystem.getSnapshot()`, death listeners, enemy and crystal shared arrays.
- Produces: `GameWorld.getOrbitalBladeSnapshot()` and a frozen HUD `weaponIds` list that adds one `orbital-blade` after UP-04 level exceeds zero.

- [x] **Step 1: Write failing integration tests** named `unlocks the blade through a real UP-04 choice and includes it once in the HUD`, `applies UP-04 rank growth and UP-01 shared damage to both weapons`, `settles same-step pulse and blade kills once through the existing crystal pipeline`, `keeps pulse gun and blade active together`, `freezes blade state and target health during PAUSED and LEVEL_UP`, `freezes blade angle and target health after player death`, and `clears rank, angle, cooldown, entities, and HUD blade on reset`.
- [x] **Step 2: Run `npm test -- tests/game-world-orbital-blade.test.js` and observe failures against the existing GameWorld API.**
- [x] **Step 3: Inject and update OrbitalBladeSystem after ProjectileSystem but before `#settleEnemyDeaths`; derive HUD equipment without mutating Player's pulse-gun cooldown state; reset blade state with the other run state.**
- [x] **Step 4: Run the integration test and affected existing tests: `tests/game-world-hud.test.js`, `tests/game-world-upgrade-effects.test.js`, `tests/pulse-gun-world.test.js`, `tests/experience-system.test.js`.**
- [x] **Step 5: Commit integration tests and GameWorld as `feat: connect orbital blade to game world`.**

### Task 3: Canvas, HUD, full verification, and delivery

**Files:**
- Create: `src/rendering/OrbitalBladeRenderer.js`
- Modify: `src/rendering/CanvasRenderer.js`
- Modify: `src/core/Game.js`
- Modify: `src/ui/UIManager.js`
- Modify: `src/styles.css`
- Modify: `tests/enemy-renderer.test.js`
- Create: `tests/orbital-blade-renderer.test.js`
- Modify: `tests/ui-manager.test.js`
- Modify: `docs/architecture.md`
- Modify: `docs/decisions.md`
- Modify: `docs/requirements.md`
- Modify: `docs/development-plan.md`
- Modify: `docs/task-status.md`
- Create: `docs/task-report-T013.md`

**Interfaces:**
- Consumes: frozen snapshot from `GameWorld.getOrbitalBladeSnapshot()`.
- Produces: optional fifth `CanvasRenderer.render(..., orbitalBladeSnapshot)` argument; HUD name plus decorative, assistive-technology-hidden blade diamond derived from `weaponIds`.

- [x] **Step 1: Write failing tests** named `draws only an active visible blade snapshot`, `draws a partially visible rotated diamond at the viewport edge`, `renders blade between enemies and player`, `Game passes the world's immutable blade snapshot to CanvasRenderer`, and `shows the orbital blade label/icon only after unlock and removes it on reset`.
- [x] **Step 2: Run focused renderer/UI tests and observe the missing rendering and HUD synchronization.**
- [x] **Step 3: Implement simple clipped purple diamond drawing using rotated bounds for culling; pass the snapshot through Game/CanvasRenderer; render the unlocked blade icon without changing readable weapon names.**
- [x] **Step 4: Run all tests (`npm test`), production build (`npm run build`), and `git diff --check`.**
- [x] **Step 5: Browser-check menu/start, orbital renderer output, HUD unlock/upgraded state, no console errors, and reset where the available browser allows. Record limitations honestly.**
- [x] **Step 6: Update architecture and D-013/D-034 decision status; complete T013 status and task report with exact test/build/browser/review results.**
- [x] **Step 7: Commit the display and architecture/decision documentation as `feat: render orbital blade and sync HUD`.**

After the independent read-only review, the Important configuration-replacement finding was fixed using RED→GREEN tests; the reviewer confirmed the fix and found no new issues. The complete suite/build were rerun, and `docs/task-report-T013.md` and `docs/task-status.md` now contain acceptance evidence. Commit the acceptance record separately. Do not push, merge, or publish. After T013 is accepted, continue with T014 under the user's standing authorization.
