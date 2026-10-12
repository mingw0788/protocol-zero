# T011 Upgrade Choice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Present up to three legal upgrade choices for every queued level-up and return to gameplay only after all queued choices are confirmed.

**Architecture:** A focused `UpgradeSystem` owns configured upgrade levels and immutable candidate snapshots. `GameWorld` prepares candidates before entering `LEVEL_UP`, validates each choice, and consumes one pending choice; `Game` exposes the action while `UIManager` renders an accessible modal panel. T011 records chosen levels and implements the full-health fallback; T012 applies upgrade effects.

**Tech Stack:** Existing native JavaScript ES modules, DOM/CSS, Canvas 2D, Vitest, Vite; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-12-t011-upgrade-choice-design.md`

## Global Constraints

- Preserve SRS upgrade IDs UP-01–UP-06 and maximum levels `5, 5, 2, 5, 5, 5`.
- Draw up to three distinct eligible options without replacement; show fewer when fewer are legal.
- When all configured upgrades are maxed, offer repeatable full-health restoration without increasing maximum health or upgrade level.
- One card activation consumes one queued choice; `LEVEL_UP` remains frozen until the queue is empty.
- Escape cannot dismiss or skip level-up choices.
- T011 records levels and choices; actual attribute/weapon effects belong to T012/T013.
- Do not install dependencies or change confirmed gameplay values.

## Review Focus

- Invalid random output must not partially replace the current candidate list — Task 1 asserts the previous state is unchanged.
- Duplicate, stale, or unoffered IDs must not change upgrade levels or player health — Task 1 covers invalid selection and Task 2 covers rejected GameWorld actions.
- Candidate pools of 1, 2, or 0 eligible upgrades must show the exact legal count or the full-health fallback — Task 1 covers all three.
- Multiple pending choices must produce a fresh set after each selection while state and clock remain frozen — Task 2 covers a three-choice pickup.
- Escape, focus movement, panel visibility, and repeated UI start/stop must not bypass state or duplicate actions — Task 3 covers the keyboard and lifecycle cases.

---

### Task 1: Build the upgrade configuration and candidate system

**Files:**
- Create: `src/config/upgradeConfig.js`
- Create: `src/systems/UpgradeSystem.js`
- Test: `tests/upgrade-system.test.js`

**Interfaces:**
- Consumes: `Player` fields `hp/maxHp`; injected `random()` and optional upgrade configuration.
- Produces: frozen `UPGRADE_CONFIG`; `UpgradeSystem({ player, random = Math.random, upgrades = UPGRADE_CONFIG })`; `prepareChoices() -> frozen choice[]`; `getChoicesSnapshot()`; `getUpgradeLevelsSnapshot()`; `getLevel(id)`; `select(choiceId) -> frozen result | false`; `reset()`.
- A normal choice snapshot is `{ id, name, description, currentLevel, targetLevel, maxLevel, repeatable: false }`. The fallback ID is `full-repair`, with `repeatable: true`; selecting it sets `player.hp = player.maxHp` and does not change upgrade levels.
- A normal selection result is `{ id, previousLevel, level, maxLevel }`; the fallback result is `{ id: 'full-repair', type: 'restore-health' }`.

- [ ] **Step 1: Write failing tests** named `freezes the six SRS upgrade definitions`, `draws three distinct eligible candidates with injected RNG`, `filters maxed options and returns one or two remaining choices`, and `offers repeatable full repair when no upgrade remains`; assert SRS maxima, unique IDs, immutable values, exact candidate count, and restored `hp === maxHp` without a level increase.
- [ ] **Step 2: Run the focused tests and confirm the missing config/system fails.**

Run: `npm test -- tests/upgrade-system.test.js`
Expected: FAIL because the module/API does not exist.

- [ ] **Step 3: Add the failing test** `rejects stale choices and invalid random/config values atomically`; assert unknown IDs leave levels/health unchanged, duplicate IDs and invalid maxima throw `RangeError`, and invalid RNG leaves the previous frozen choice snapshot intact.
- [ ] **Step 4: Run the focused test again and confirm invalid-input cases fail** for the expected missing validation.
- [ ] **Step 5: Add the frozen `UPGRADE_CONFIG`** with the six SRS IDs, names, descriptions and maxima; implement constructor/config validation, uniform partial Fisher–Yates sampling without replacement, immutable snapshots, legal selection, level tracking, full-health fallback, and reset.
- [ ] **Step 6: Run `npm test -- tests/upgrade-system.test.js` and confirm every focused case passes.**
- [ ] **Step 7: Commit** as `feat: add upgrade choice system`.

### Task 2: Connect choices to GameWorld and Game

**Files:**
- Modify: `src/core/GameWorld.js`
- Modify: `src/core/Game.js`
- Test: `tests/game-world-upgrades.test.js`
- Test: `tests/game-actions.test.js`

**Interfaces:**
- Consumes: `UpgradeSystem` from Task 1; T010 `LevelSystem.completePendingLevelUp()` and controlled `LEVEL_UP` state.
- Produces: `world.upgradeSystem`; `GameWorld.getUpgradeChoices()`; `GameWorld.chooseUpgrade(id) -> boolean`; `Game.getUpgradeChoices()`; `Game.chooseUpgrade(id) -> boolean`.
- Add independent `upgradeRandom = Math.random` injection so upgrade draws do not change the enemy spawn random sequence.

- [ ] **Step 1: Write the failing test** `prepares candidates before LEVEL_UP state listeners run`; pick up 35 XP, assert three pending choices, and assert the first frozen candidate group is already readable inside the synchronous state listener.
- [ ] **Step 2: Run the integration test and confirm it fails** because GameWorld/Game do not expose upgrade choices/actions.
- [ ] **Step 3: Add failing tests** `consumes one choice per selection while the world remains frozen`, `rejects stale choices without changing levels or queue`, and `resets upgrade state without shifting enemy randomness`; assert a 35-XP pickup needs three selections, elapsed time/step count stay fixed until the last one, invalid actions preserve snapshots, and reset returns levels/candidates to baseline.
- [ ] **Step 4: Run the focused integration tests and confirm the new assertions fail** for missing validation, queue consumption and candidate refresh.
- [ ] **Step 5: Connect the system**; prepare candidates before `beginLevelUp()`, accept selection only in LEVEL_UP with a nonempty queue, consume one T010 pending choice, refresh candidates only when choices remain, and clear candidates after the final choice. Reset UpgradeSystem with the run.
- [ ] **Step 6: Run `npm test -- tests/game-world-upgrades.test.js tests/game-actions.test.js tests/level-system.test.js` and confirm green.**
- [ ] **Step 7: Commit** as `feat: connect upgrade choices to game world`.

### Task 3: Render the accessible level-up panel

**Files:**
- Modify: `index.html`
- Modify: `src/ui/UIManager.js`
- Modify: `src/styles.css`
- Test: `tests/ui-manager.test.js`

**Interfaces:**
- Consumes: `Game.getUpgradeChoices()` and `Game.chooseUpgrade(id)` from Task 2; `GAME_STATES.LEVEL_UP`.
- Produces: a hidden-by-default upgrade panel with a dialog title, live remaining-choice count and three static card buttons; `UIManager` shows it only during LEVEL_UP and re-renders the next candidate snapshot after a successful choice.

- [ ] **Step 1: Add failing tests** `shows choices only during LEVEL_UP` and `hides unused slots and refreshes each queued choice`; assert dialog/HUD/menu visibility, card names/descriptions/levels, 1/2-slot hiding, button activation, and next-choice content.
- [ ] **Step 2: Run the focused tests and confirm they fail** because the panel and event wiring are absent.
- [ ] **Step 3: Add the failing test** `traps keyboard focus and prevents Escape from skipping choices`; assert first-card focus, Enter/Space selection, Tab/Shift+Tab wrap, and unchanged state/queue on Escape. Add `removes upgrade listeners across repeated start and stop` and assert no duplicate selection after restart.
- [ ] **Step 4: Run the focused UI tests again and confirm keyboard/lifecycle assertions fail** for the expected missing behavior.
- [ ] **Step 5: Add three static semantic card buttons** and dialog/live-region labels to `index.html`; style the panel/card layout with existing colors and narrow-screen scroll behavior.
- [ ] **Step 6: Implement UIManager rendering and action wiring**; activation calls only `Game.chooseUpgrade`, successful multi-choice selection refreshes the snapshot, and final selection relies on the state subscription to hide the panel and restore game focus.
- [ ] **Step 7: Run `npm test -- tests/ui-manager.test.js` and confirm all UI cases pass.**
- [ ] **Step 8: Commit** as `feat: add level-up choice interface`.

### Task 4: T011 acceptance, browser check, and report

**Files:**
- Modify: `docs/requirements.md`
- Modify: `docs/architecture.md`
- Modify: `docs/decisions.md`
- Modify: `README.md`
- Modify: `docs/task-status.md`
- Create: `docs/task-report-T011.md`
- Modify: this plan

**Interfaces:**
- Consumes: T011 design/implementation and automated evidence from Tasks 1–3.
- Produces: an auditable T011 status/report; T012 remains responsible for actual attribute effects.

- [ ] **Step 1: Run the full `npm test` suite, `npm run build`, and `git diff --check`; record exact results without installing dependencies.**
- [ ] **Step 2: Start the existing local preview and use an available browser to play until a natural level-up appears; verify cards, Escape lockout, continuous queue freeze, resume after final selection, and zero console errors.** If the flow cannot be reached in the available browser session, record it as unverified and preserve unit/integration evidence.
- [ ] **Step 3: Update SRS/SDD status, D-030/D-031, README, task status and `docs/task-report-T011.md`; identify that actual upgrade effects remain in T012.**
- [ ] **Step 4: Commit** as `docs: record T011 upgrade choice acceptance`.

## Plan Self-Review

- **Spec coverage:** SRS pool/maxima, distinct legal choices, fewer-than-three behavior, repeatable full-health fallback, immutable snapshots, per-choice queue consumption, LEVEL_UP freeze, Escape handling, focus behavior, reset, error validation, and T012/T013 boundary map to Tasks 1–4.
- **Step clarity:** Each implementation area has a failing test, a focused command, the named interface, a green verification step, and a commit boundary.
- **Interface consistency:** Task 1 defines `prepareChoices/select/getChoicesSnapshot`; Task 2 exposes choice reads/actions through GameWorld and Game; Task 3 consumes those exact controller methods.
- **Review focus:** Invalid RNG, stale IDs, small/empty candidate pools, multi-choice timing, and keyboard/lifecycle behavior each have explicit tests in their owning task.
- **Scope:** No effect formula, player-stat upgrade, weapon implementation, random weighting, added dependency, or confirmed SRS value change is included.
