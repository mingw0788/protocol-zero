# T032 Progression, Supplies and Relay Energy Plan

> Native inline execution is authorized by the user's ongoing instruction to continue without check-ins until development is complete. Read `docs/superpowers/specs/2026-10-13-t032-progression-supplies-relay-design.md` first.

**Goal:** Show level progress, keep the rail visual attached to its weapon, and add useful supplies and relay recharge gameplay.

**Architecture:** Systems own data/state; GameWorld composes immutable snapshots and dispatches existing damage/death contracts; Canvas and DOM only read snapshots.

**Tech Stack:** Existing ES modules, Canvas 2D, Web Audio, Vitest; no dependencies.

**Review focus:** reset and double settlement; pause-time leakage; full-health/occupied inventory pickups; station range boundaries; visual shift must not alter collision; immutable XP snapshot.

- [x] Add failing tests for anchored rail visual and XP threshold snapshot/UI.
- [x] Add failing system and GameWorld tests for energy recharge, three item behaviors, inventory retention, boundaries, reset and pause.
- [x] Implement weapon snapshot anchoring and XP progress display.
- [x] Implement local kill-energy recharge and E relay cell; implement repair gel and EMP charge in the active item contract.
- [x] Render/document all states and update requirements/architecture/status/README.
- [x] Run full tests/build, inspect Chrome and Edge views, review performance risks, commit and report.
