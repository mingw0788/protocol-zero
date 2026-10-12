# T018 Implementation Plan

**Goal:** Add short synthesized game-event audio with accessible runtime mute and volume controls, with graceful browser failure behavior.

**Spec:** `docs/superpowers/specs/2026-10-12-t018-audio-system-design.md`

## Task 1: Audio manager and settings contract

- [x] Write tests for lazy context creation, event tone, mute/volume, voice cap, unsupported API and disposal.
- [x] Run focused tests red.
- [x] Add immutable audio config and AudioManager with injectable context factory; synthesize bounded short tones using Web Audio only.
- [x] Run focused tests green and commit `feat: add synthesized audio manager`.

## Task 2: Connect actual game events

- [x] Write GameWorld/Game tests for exactly-once semantic event notifications and lifecycle behavior.
- [x] Add a narrow frozen sound-event subscription API to GameWorld and emit only for actual firing, damage/death, enemy death, selected upgrade, and accepted run outcome.
- [x] Connect one AudioManager listener in Game, unlock only on user gesture, disconnect/dispose on stop, preserve runtime settings across reset.
- [x] Run focused world/action tests and commit `feat: connect audio to run events`.

## Task 3: Accessible menu controls and acceptance

- [x] Add labeled 0–100 volume control alongside the existing mute switch; test changes and runtime preference retention.
- [x] Run `npm test`, `npm run build`, `git diff --check`; check browser playback, controls, polyphony behavior, unsupported API fallback and console.
- [x] Update architecture, SRS trace, D-015 decision, status and T018 report; commit `docs: record T018 audio acceptance`.

## Constraints

- No background music, audio downloads, added dependencies or gameplay changes.
- Game must remain fully usable if AudioContext is missing or unusable.
- Do not create AudioContext before an explicit user gesture.
