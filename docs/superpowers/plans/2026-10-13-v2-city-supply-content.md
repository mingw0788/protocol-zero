# V2 City Supply Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Deliver the approved city map, supplies and two weapons in the playable local game.

**Architecture:** Keep GameWorld and existing simulation owners. Add a map registry, a supply/item system and independent arc/rail weapon systems; read-only snapshots feed UI and Canvas. Both maps share the existing world bounds.

**Tech Stack:** Existing JavaScript ES modules, Canvas, HTML/CSS, Vite, Vitest. No new dependencies.

**Spec:** docs/superpowers/specs/2026-10-13-v2-city-supply-content-design.md

## Global Constraints

- 2400×1350 world, 1280×720 logical viewport, existing fixed step and five-minute victory rules.
- Lab remains the default map. Map selection only in MENU; selection persists across run resets.
- E is an edge-triggered item action; no F action or new game state.
- All new clocks freeze outside PLAYING; reset clears every run effect, entity and pending input.
- No new dependencies, save schema, remote publication or V1 release-tag changes.
- Native execution is authorized by the user's continuing-development instruction. Do not request further approval for routine choices.

## Review Focus

- Duplicate/dead target IDs: one hit and one death settlement per shot (Task 3).
- A supply threshold or expiry crossed by a large delta: no late backfill or free charging for time before appearance (Task 2).
- Held E across pause/restart and full item slot: no unwanted deployment or lost pickup (Tasks 2/4).
- Overclock expiry while a shot is cooling down: preserve absolute cooldown; apply changed multiplier on the next shot (Tasks 2/3).
- Older save data and a narrow viewport: new UI works without invalidating old records or hiding controls (Task 5).

### Task 1 / T022: Map selection and city presentation

**Files:** src/config/mapConfig.js; src/core/Game.js; src/core/GameWorld.js; src/rendering/MapRenderer.js; src/ui/UIManager.js; index.html; src/styles.css; tests/map-selection.test.js; tests/map-rendering.test.js; tests/ui-manager.test.js.

**Interfaces:** MAP_CONFIGS and getMapConfig(id); Game.selectMap(id): boolean, getMapSnapshot(): frozen {id,name}; GameWorld.setMap(id): boolean; MapRenderer.setMap(config). Keep existing HUD shape and expose extension state separately to preserve consumers.

- [ ] Write map-selection tests: default lab, city selection in MENU, rejection during PLAYING/PAUSED, same selection on restart, invalid ID rejected.
- [ ] Run npm test -- tests/map-selection.test.js; expected failure for missing map APIs.
- [ ] Implement frozen map definitions, controller/world selection and a clearly different city road rendering with shared bounds. Add accessible menu select and map label; optional extension controls keep existing fake UI fixtures compatible.
- [ ] Run npm test -- tests/map-selection.test.js tests/map-rendering.test.js tests/ui-manager.test.js; expected all passing.
- [ ] Commit Task 1.

### Task 2 / T023: Supply stations, items and input

**Files:** src/config/supplyConfig.js; src/systems/SupplySystem.js; src/input/InputController.js; src/systems/EnemySystem.js; src/systems/ExperienceSystem.js; src/core/GameWorld.js; tests/supply-system.test.js; tests/input-controller.test.js; tests/game-world-supplies.test.js.

**Interfaces:** SupplySystem({player,random,config}); setEnabled(bool), update(deltaSeconds,elapsedSeconds), deploy(): boolean, getSnapshot(): frozen state, reset(); fireRateMultiplier and pickupRadiusBonus getters; targetFor(enemy): target or null. InputController.consumeItemUsePress(): boolean. GameWorld.getSupplySnapshot() exposes presentation data.

- [ ] Write behavior tests for 45/135/225 schedules, 25-second expiry, 56 radius, 1.5-second dwell, no retrospective dwell for large steps, one reward, equal random weights, 60-second pickup expiry, +30%/8-second battery, 5-second/420-radius decoy, scanner +8/max3, full capacity preservation, reset and invalid arguments.
- [ ] Run npm test -- tests/supply-system.test.js; expected missing module failure.
- [ ] Implement schedule/capsule/effect ownership in SupplySystem, independent supply random stream, E one-shot queue, optional enemy decoy target and optional experience pickup bonus. Wire after movement and before enemy AI; reset clears queue and supplies.
- [ ] Add pause/level-up/reset integration and E repeat/blur tests; run npm test -- tests/supply-system.test.js tests/game-world-supplies.test.js tests/input-controller.test.js tests/experience-system.test.js tests/enemy-world.test.js; expected all passing.
- [ ] Commit Task 2.

### Task 3 / T024–T026: Weapon systems and upgrade integration

**Files:** src/config/expansionWeaponConfig.js; src/systems/ArcCoilSystem.js; src/systems/RailgunSystem.js; src/systems/weaponTargeting.js; src/config/upgradeConfig.js; src/systems/UpgradeEffectSystem.js; src/systems/WeaponSystem.js; src/systems/OrbitalBladeSystem.js; src/core/GameWorld.js; tests/expansion-weapons.test.js; tests/game-world-expansion-weapons.test.js; related upgrade tests.

**Interfaces:** Both weapons use constructor {player,enemies,enemyDamageSystem,config}; update({deltaSeconds,level,damageMultiplier,fireRateMultiplier}), reset(), getSnapshot(). Snapshot contains transient beam segments, not mutable enemies. UP-07/08 expose arcCoilLevel/railgunLevel and add player weaponStates on first unlock. fireRateMultiplier defaults to 1 for existing weapon callers.

- [ ] Write tests pinning arc damage16/interval1.1/range360/jump150/targets3/falloff0.7; rail damage28/interval1.2/range800/targets3; level1 base and level5 ×1.48/max5; nearest targeting, dead/duplicate IDs, ray entry ordering, Boss compatibility, cooldown/reset and finite validation.
- [ ] Run npm test -- tests/expansion-weapons.test.js; expected missing system failure.
- [ ] Implement systems with shared small targeting helpers, finite config validation and bounded visual snapshots. Add two five-level module cards and actual unlock state. Feed damage through EnemyDamageSystem and settle deaths once after all weapons. Apply battery frequency to pulse/new guns and orbital blade rotation/hit cadence without altering base config.
- [ ] Add world tests proving actual legal upgrades unlock attacks, combined kills settle once, pause/LEVEL_UP freeze and restart clears. Adjust old exact six-card assertions to eight-card data while preserving old effect assertions.
- [ ] Run npm test -- tests/expansion-weapons.test.js tests/game-world-expansion-weapons.test.js tests/upgrade-system.test.js tests/upgrade-effect-system.test.js tests/weapon-system.test.js tests/orbital-blade-system.test.js; expected passing.
- [ ] Commit Task 3.

### Task 4 / T027: World visuals and HUD

**Files:** src/rendering/ExpansionRenderer.js; src/rendering/CanvasRenderer.js; src/core/Game.js; src/core/GameWorld.js; src/ui/UIManager.js; index.html; src/styles.css; tests/expansion-renderer.test.js; tests/ui-manager.test.js.

**Interfaces:** GameWorld.getExpansionSnapshot(): frozen {map,supply,arc,rail}; CanvasRenderer.render keeps existing arguments and adds optional expansion snapshot last. UIManager.renderSnapshot reads Game extension snapshot optionally.

- [ ] Write tests for clipping, empty snapshots, supply/decoy/beam draws, full/empty active slot and freeze/reset display.
- [ ] Run npm test -- tests/expansion-renderer.test.js; expected missing renderer failure.
- [ ] Implement distinct station/capsule/decoy/arc/rail artwork, offscreen supply direction hint, concise E/overclock/scanner HUD, weapon names and help text. Use original Canvas shapes and existing palette.
- [ ] Run targeted renderer/UI/world tests; expected passing.
- [ ] Commit Task 4.

### Task 5 / T028: Verification, review and documentation

**Files:** README.md; docs/requirements.md; docs/architecture.md; docs/development-plan.md; docs/task-status.md; docs/decisions.md; docs/task-report-V2-content-pack.md.

- [ ] Run npm test, npm run build and git diff --check; expected all passing.
- [ ] Use available browser automation to inspect menu/map selection, city supply acquisition and E action, upgrade unlocks, pause/resume/reset and narrow layout. Record natural play separately from controlled cases; do not claim human acceptance from automation.
- [ ] Inspect bounded effects with 100 enemies and multiple resets; record measured scope.
- [ ] Review changes against the spec and fix blocking findings with targeted regression coverage.
- [ ] Synchronize authoritative docs, requirement/task mapping, exact results and remaining manual acceptance limitations. Preserve published V1 URL/tag.
- [ ] Commit delivery and report local paths plus validation evidence.

## Self-review

Each approved feature has a task; all shared method names above are consumed by the next task consistently. First-pass numeric choices are in the spec. The five review conditions have tests assigned. No external deployment is part of this plan.
