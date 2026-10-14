# T046 Campaign Polish Implementation Plan

> For agentic workers: use superpowers:executing-plans. Continuous native execution authorized by the user; one independent whole-change review at the end.

**Goal:** Deliver three sequential stages, selectable difficulty/characters, usable skills and equipment/CD display.
**Architecture:** ExpeditionSystem owns selections, route and module rewards; CharacterSkillSystem owns active cooldown/effect; GameWorld orchestrates partial stage reset and typed damage. Independent expedition records supplement existing V2 saves.
**Tech Stack:** Existing JavaScript/Canvas/DOM/Vite/Vitest; no new dependencies.
**Spec:** docs/superpowers/specs/2026-10-14-t046-campaign-polish-design.md

## Global Constraints

- Respect frozen-time states, original normal ZERO single-map rules and existing entity bounds.
- No backend, network gameplay, package installation or public release.
- Preserve old archives and prohibit unknown-version overwrite.
- User's standing authorization supersedes repeated design/plan approval requests and task-stop defaults. Work in the current local feature branch so their running workspace receives the result.

## Review Focus

- Victory and death together; pending upgrades at the stage boundary.
- Double-clicked reward/next-stage and restart from every result.
- Skills without targets/full shield and CD freezing on pause/blur.
- Imported arrays/null/unknown versions before any archive replacement.
- Small viewport overflow, focus order and gear feedback visibility.

## Tasks

### 1. Route and difficulty integration
- [x] Write world regressions for all three stages, early Boss death, death priority, inherited build and cleared entities; observe missing behavior.
- [x] Add config/ExpeditionSystem, explicitly tunable Boss variants, GameWorld integration/partial reset.
- [x] Run targeted integration tests.

### 2. Characters, active skills and equipment
- [x] Add behavior tests for stats, skills, cooldown and module reward idempotence.
- [x] Implement CharacterSkillSystem, Space input, unified stat modifiers, inventory preservation and cooldown snapshots.
- [x] Run targeted tests, verify default regressions.

### 3. Archive isolation
- [x] Write full configuration-key, damage/unknown-version and transfer regression tests.
- [x] Add independent record store, optional JSON transfer field and controller wiring; keep old exports importable.
- [x] Run record/transfer tests.

### 4. Menus, equipment/CD and feedback
- [x] Implement optional campaign UI controls, frozen intermission/module choices, status/equipment HUD, character visuals and bounded skill feedback.
- [x] Verify menu/skill/three stages/restart and 640×360 in real browser automation.

### 5. Final audit and handoff
- [x] Full tests/build; one independent code review, resolve reproducible findings.
- [x] Update SRS/SDD/decisions/status/README and T046 report with actual evidence.
- [x] Local commit; verify clean workspace and local URL.

## Execution Ledger

- Base: 98a7643. Existing feature branch codex/v2-visual-combat-feedback, clean before work.
- Ruling: Native continuous execution, current checkout retained — user requested no further questions and this workspace is already their local development branch — no push/merge/release.
- Ruling: Three existing maps become ordered stages rather than adding a fourth sparse map — current content already supports a contrasting final level — future new scenes remain possible.
- Tasks 1/2: observed missing-route API RED, then verified ordered stages, death priority, inventory/build retention and CD behavior. Corrected fixture supply ID, then diagnosed setEnabled's second reset; preservation now has regression evidence.
- Task 3: missing controller archive API RED; full export size RED at71953 bytes, compact format GREEN. Eight archive tests cover isolation, unknown/malformed data and96+128 records under64KiB.
- Task 4: Chrome155 headless/Edge152 headed actual controls through three stages passed, including640x360, cooldown freeze, module Tab loop, restart and backup restore. Controlled clock/XP/Boss fixture explicitly labeled.
- Review: independent whole-change review found no Critical/Important and two Minor. Reproduced both RED, fixed module focus and weapon flash/cooldown cleanup, verified GREEN.
- Ruling: remove BASTION's provisional10% damage penalty — first AI sample showed growth starvation, revised normal/hard samples won all three stages — human balance remains unverified.
- Final checks:83 files/583 tests passed;111 production modules built. Nine final role/difficulty AI configurations:6 normal/hard victories,3 nightmare defeats. Chrome360-frame P955.5ms; Edge foreground P954.5ms. One throttled Edge run retained separately.
- Handoff: SRS/SDD/decisions/status/README and T046 report updated. Implementation committed as8234aa2; clean workspace checked after implementation commit, local HTTP200. Follow-up documentation records completion; no push/merge/release.
