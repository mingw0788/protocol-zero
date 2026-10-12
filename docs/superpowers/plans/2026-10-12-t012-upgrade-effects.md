# T012 Upgrade Effects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Keep the checked task sequence and commit each completed task before starting the next.

**Goal:** Make all non-orbital T012 upgrades change actual run state and ensure UP-04 level data is ready for T013.

**Architecture:** A frozen effect configuration and `UpgradeEffectSystem` derive immutable, linear-stacking modifiers from T011 upgrade levels. `GameWorld` applies successful choices, updates player movement/health, and passes the immutable snapshot into `WeaponSystem`; pulse shots consume shared damage, fire-rate, and projectile-count modifiers.

**Tech Stack:** Existing JavaScript ES Modules, Canvas 2D, Vitest, Vite; no added dependencies.

**Spec:** `docs/superpowers/specs/2026-10-12-t012-upgrade-effects-design.md`

## Global Constraints

- Preserve SRS values: UP-01 +15% damage/rank (max 5); UP-02 +12% pulse-gun fire rate/rank (max 5); UP-03 +1 projectile/rank (max 2); UP-04 max 5; UP-05 +8% movement speed/rank (max 5); UP-06 +20 max HP and +20 current HP/rank (max 5).
- Apply D-032 `base × (1 + perLevelBonus × level)` with full internal numeric precision.
- UP-03 emits at most 3 total projectiles using symmetric centered spread with configurable 12° adjacent spacing (D-033).
- Do not mutate shared player or weapon base configuration. Reset every run effect to its baseline.
- Actual orbital blade movement/attacks and visuals remain T013. No install, service, account, or network dependency.

## Review Focus

1. Maximum-rank formulas remain linear and do not compound or drift after repeated selections.
2. Selecting UP-06 while damaged, full, or near the new cap cannot produce invalid `hp > maxHp`.
3. A speed upgrade preserves a custom constructor `moveSpeed` base and reset restores that base.
4. A pulse-gun upgrade preserves absolute time already remaining on cooldown and uses the new interval after the next shot.
5. Every multi-shot volley has the right count, symmetric angles, unique IDs, and immutable per-projectile damage once in flight.

---

### Task 1: Central upgrade effect configuration and snapshots

**Files:**
- Create: `src/config/upgradeEffectConfig.js`
- Create: `src/systems/UpgradeEffectSystem.js`
- Modify: `src/entities/Player.js`
- Test: `tests/upgrade-effect-system.test.js`
- Test: `tests/player.test.js`

**Interfaces:**
- Consumes: `UpgradeSystem.getUpgradeLevelsSnapshot()` and `getLevel(id)`; each level snapshot is `{ id, level, maxLevel }`.
- Produces: `new UpgradeEffectSystem({ player, upgradeSystem })`, `getSnapshot()`, and `applySelection(selection)`. The frozen snapshot is `{ damageMultiplier, pulseGunFireRateMultiplier, pulseGunProjectileCount, moveSpeedMultiplier, orbitalBladeLevel }`.
- `applySelection(selection)` accepts the frozen `{ id, previousLevel, level, maxLevel }` result from a successful `UpgradeSystem.select()`, applies UP-06 health growth/heal and derives `player.moveSpeed` from `player.baseMoveSpeed`; it returns the current frozen snapshot.

- [ ] **Step 1: Add failing tests** `derives zero and maximum-rank linear modifiers`, `exposes orbital blade level without equipping it`, `applies nano armor healing under the new health cap`, and `derives movement from base speed and reset restores that base`. Assert levels 0 and each maximum, UP-01 multiplier 1.75, UP-02 multiplier 1.6, projectile counts 1/2/3, UP-05 multiplier 1.4, UP-04 level, UP-06 `maxHp + 20` and `min(newMaxHp, hp + 20)`, frozen snapshots, unchanged shared config, and custom-speed reset.
- [ ] **Step 2: Run the focused tests and confirm they fail** because effect config/system and `baseMoveSpeed` do not exist.
- [ ] **Step 3: Implement frozen `UPGRADE_EFFECT_CONFIG` fields** `damageBonusPerLevel`, `pulseGunFireRateBonusPerLevel`, `extraProjectilesPerLevel`, `exposesOrbitalBladeLevel`, `moveSpeedBonusPerLevel`, `maxHpIncreasePerLevel`, and `healPerLevel`; add the validated `UpgradeEffectSystem`, derived effect snapshot, and `Player.baseMoveSpeed` reset behavior. Reject unknown/missing levels, out-of-cap levels, non-finite parameters, and selections that do not match the current recorded level before applying any player mutation.
- [ ] **Step 4: Run `npm test -- tests/upgrade-effect-system.test.js tests/player.test.js` and confirm the new calculations and reset tests pass.**
- [ ] **Step 5: Commit** as `feat: add upgrade effect model`.

### Task 2: Apply modifiers to pulse-gun projectiles

**Files:**
- Modify: `src/config/weaponConfig.js`
- Modify: `src/systems/WeaponSystem.js`
- Test: `tests/weapon-system.test.js`

**Interfaces:**
- Consumes: the immutable effect snapshot from Task 1.
- Produces: `WeaponSystem.update({ player, enemies, projectiles, deltaSeconds, upgradeEffects })`; omitted `upgradeEffects` uses the neutral snapshot and preserves all existing T008 behavior.
- Adds `multiShotAngleStepDegrees: 12` to `PULSE_GUN_CONFIG`; every volley centers its evenly spaced directions on the existing nearest-target aim vector.

- [ ] **Step 1: Add failing tests** `applies damage and attack-rate modifiers`, `keeps current cooldown as absolute remaining time`, `fires two and three evenly spaced projectiles`, `keeps projectile damage fixed after firing`, and `rejects invalid effect snapshots`. Assert rank-5 damage 35, rank-5 interval 0.5 seconds after a shot, exact projectile totals 2/3, angle offsets ±6° and −12°/0°/+12°, unique IDs, and unchanged baseline firing when omitted.
- [ ] **Step 2: Run `npm test -- tests/weapon-system.test.js` and confirm each new assertion fails for the expected missing modifier behavior.**
- [ ] **Step 3: Implement finite/range validation, base damage scaling, fire interval scaling, and symmetric projectile generation.** Keep target selection, range, projectile speed/lifetime, collision, and damage ownership unchanged.
- [ ] **Step 4: Run `npm test -- tests/weapon-system.test.js` and confirm the upgraded and baseline weapon cases pass.**
- [ ] **Step 5: Commit** as `feat: apply pulse gun upgrades`.

### Task 3: Connect effects to GameWorld choices and reset

**Files:**
- Modify: `src/core/GameWorld.js`
- Test: `tests/game-world-upgrades.test.js`
- Test: `tests/game-world-hud.test.js` only if a read-only stat snapshot assertion needs a focused location

**Interfaces:**
- Consumes: Task 1 `UpgradeEffectSystem` and Task 2 `WeaponSystem.update(..., upgradeEffects)`.
- Produces: `GameWorld.getUpgradeEffectSnapshot()` as a frozen read-only snapshot for T013, applies a successful choice result exactly once, passes current effects to `WeaponSystem`, and restores neutral effects on reset.

- [ ] **Step 1: Add failing integration tests** `applies each selected upgrade to live gameplay`, `does not apply effects for an invalid choice`, `passes pulse modifiers to the next shot`, and `clears every upgrade effect on a fresh run`. Use real crystals to enter `LEVEL_UP`, choose offered IDs, and assert movement, health, next-shot data, queue freeze, and reset values.
- [ ] **Step 2: Run `npm test -- tests/game-world-upgrades.test.js tests/game-world-hud.test.js` and confirm the new assertions fail because GameWorld does not yet connect effects.**
- [ ] **Step 3: Construct `UpgradeEffectSystem` after `UpgradeSystem`; apply successful selection results before consuming the pending choice; pass `getSnapshot()` into `WeaponSystem.update()`; expose only a frozen snapshot; rely on Player/UpgradeSystem reset to restore base values and neutral modifiers.**
- [ ] **Step 4: Run `npm test -- tests/game-world-upgrades.test.js tests/game-world-hud.test.js tests/game-actions.test.js tests/weapon-system.test.js` and verify consecutive choices remain frozen and final selection resumes.**
- [ ] **Step 5: Commit** as `feat: connect upgrades to game world`.

### Task 4: T012 acceptance, documentation, and report

**Files:**
- Modify: `docs/requirements.md`
- Modify: `docs/architecture.md`
- Modify: `docs/decisions.md`
- Modify: `README.md`
- Modify: `docs/task-status.md`
- Create: `docs/task-report-T012.md`
- Modify: this plan

- [ ] **Step 1: Run `npm test`, `npm run build`, and `git diff --check`; record exact results without installing dependencies.**
- [ ] **Step 2: Attempt available browser verification of actual upgrade effects only if normal gameplay reaches an upgrade.** Record the exact run facts and console output; if no upgrade appears before death, mark UI/effect behavior unverified in browser and retain automated evidence without claiming a browser pass.
- [ ] **Step 3: Record D-012/D-032/D-033 implementation status, T012 boundaries, verification evidence, and the T013 orbital blade handoff in SRS/SDD/README/task status/report.**
- [ ] **Step 4: Commit** as `docs: record T012 upgrade effects acceptance`.

## Plan Self-Review

- **Spec coverage:** Every SRS effect is mapped to the config/system/weapon/GameWorld tasks; UP-04 is exposed to T013 but remains unequipped, full-health fallback remains T011-owned, reset restores all base attributes, and D-012/D-033 are explicit.
- **Step clarity:** Each implementation task starts with named failing tests and focused commands, gives the exact interfaces, and commits at a testable boundary.
- **Interface consistency:** Task 1 defines the snapshot names consumed by Task 2 and exposed by Task 3; Task 3 applies `UpgradeSystem.select()` results and feeds the same snapshot to `WeaponSystem`.
- **Review focus:** Formula drift, health clamping, custom movement bases, in-flight cooldown semantics, and projectile count/geometry/identity have explicit coverage.
- **Scope:** No orbital blade attacks, new upgrade ranks, balance changes, added dependencies, or modifications to confirmed base values.
