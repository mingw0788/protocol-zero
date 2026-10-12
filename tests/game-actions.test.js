import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/Game.js';
import { GAME_STATES } from '../src/core/GameStateManager.js';
import { ExperienceCrystal } from '../src/entities/ExperienceCrystal.js';

function createGame() {
  return new Game({
    loopOptions: {
      requestAnimationFrame: () => 1,
      cancelAnimationFrame: () => {},
      windowTarget: null,
      documentTarget: null,
    },
    inputOptions: { windowTarget: null, documentTarget: null },
  });
}

describe('Game menu and pause actions', () => {
  it('allows only a controlled single terminal transition and restart from results', () => {
    const game = createGame();

    expect(game.stateManager.finishRun('UNKNOWN')).toBe(false);
    expect(game.stateManager.transitionTo(GAME_STATES.VICTORY)).toBe(false);
    expect(game.stateManager.finishRun(GAME_STATES.VICTORY)).toBe(false);
    game.startGame();

    expect(game.stateManager.finishRun(GAME_STATES.VICTORY)).toBe(true);
    expect(game.stateManager.finishRun(GAME_STATES.DEFEAT)).toBe(false);
    expect(game.stateManager.pause()).toBe(false);
    expect(game.stateManager.resume()).toBe(false);
    expect(game.stateManager.restartRun()).toBe(true);
    expect(game.stateManager.currentState).toBe(GAME_STATES.PLAYING);
  });

  it('keeps the initial menu frozen until the player starts', () => {
    const game = createGame();
    game.start();
    game.world.update(2);

    expect(game.stateManager.currentState).toBe(GAME_STATES.MENU);
    expect(game.clock.elapsedSeconds).toBe(0);
    expect(game.togglePause()).toBe(false);
    expect(game.returnToMenu()).toBe(false);
    game.stop();
  });

  it('starts a clean run only once and ignores another start while playing', () => {
    const game = createGame();
    game.world.player.hp = 10;
    game.world.recordKill();
    game.clock.advance(4);

    expect(game.startGame()).toBe(true);
    expect(game.getHudSnapshot()).toMatchObject({
      health: { current: 100, max: 100 },
      killCount: 0,
      elapsedSeconds: 0,
    });
    game.world.update(2);
    game.world.player.hp = 70;

    expect(game.startGame()).toBe(false);
    expect(game.clock.elapsedSeconds).toBe(2);
    expect(game.world.player.hp).toBe(70);
  });

  it('toggles pause without advancing time or returning directly from battle', () => {
    const game = createGame();
    game.startGame();
    game.world.update(3);

    expect(game.returnToMenu()).toBe(false);
    expect(game.togglePause()).toBe(true);
    expect(game.stateManager.currentState).toBe(GAME_STATES.PAUSED);
    game.world.update(10);
    expect(game.clock.elapsedSeconds).toBe(3);
    expect(game.startGame()).toBe(false);
    expect(game.togglePause()).toBe(true);
    expect(game.stateManager.currentState).toBe(GAME_STATES.PLAYING);
    expect(game.clock.elapsedSeconds).toBe(3);
  });

  it('resets before notifying the menu and allows a fresh start afterwards', () => {
    const game = createGame();
    game.startGame();
    game.world.update(5);
    game.world.player.hp = 20;
    game.world.player.exp = 9;
    game.world.player.level = 3;
    game.world.player.weaponStates.push({ id: 'orbital-blade' });
    game.world.recordKill();
    game.pause();
    let snapshotOnMenu;
    game.stateManager.subscribe((state) => {
      if (state === GAME_STATES.MENU) snapshotOnMenu = game.getHudSnapshot();
    });

    expect(game.returnToMenu()).toBe(true);
    expect(snapshotOnMenu).toEqual({
      health: { current: 100, max: 100 },
      experience: 0,
      level: 1,
      pendingLevelUps: 0,
      weaponIds: ['pulse-gun'],
      killCount: 0,
      elapsedSeconds: 0,
    });
    expect(game.startGame()).toBe(true);
    game.world.update(1);
    expect(game.clock.elapsedSeconds).toBe(1);
  });

  it('exposes validated upgrade reads and choice actions through Game', () => {
    const game = createGame();

    expect(game.getUpgradeChoices()).toEqual([]);
    expect(game.chooseUpgrade('UP-01')).toBe(false);
    game.startGame();
    game.world.experienceCrystals.push(new ExperienceCrystal({
      id: 'game-controller-level-up',
      x: game.world.player.x,
      y: game.world.player.y,
      expValue: 6,
    }));
    game.world.update(1 / 60);

    const choices = game.getUpgradeChoices();
    expect(choices).toHaveLength(3);
    expect(Object.isFrozen(choices)).toBe(true);
    expect(game.chooseUpgrade('not-offered')).toBe(false);
    expect(game.world.levelSystem.pendingLevelUps).toBe(1);

    expect(game.chooseUpgrade(choices[0].id)).toBe(true);
    expect(game.stateManager.currentState).toBe(GAME_STATES.PLAYING);
    expect(game.getUpgradeChoices()).toEqual([]);
  });

  it('clears upgrade levels when returning to the menu and starting a new run', () => {
    const game = createGame();
    game.startGame();
    game.world.experienceCrystals.push(new ExperienceCrystal({
      id: 'upgrade-reset-level-up',
      x: game.world.player.x,
      y: game.world.player.y,
      expValue: 6,
    }));
    game.world.update(1 / 60);
    const selectedId = game.getUpgradeChoices()[0].id;
    expect(game.chooseUpgrade(selectedId)).toBe(true);
    expect(game.world.upgradeSystem.getLevel(selectedId)).toBe(1);

    game.pause();
    expect(game.returnToMenu()).toBe(true);
    expect(game.startGame()).toBe(true);

    expect(game.world.upgradeSystem.getLevel(selectedId)).toBe(0);
    expect(game.getUpgradeChoices()).toEqual([]);
  });

  it('restarts a finished run from a clean world while preserving runtime sound preference', () => {
    const game = createGame();
    game.toggleSound();
    game.startGame();
    game.world.experienceCrystals.push(new ExperienceCrystal({
      id: 'restart-level-up', x: game.world.player.x, y: game.world.player.y, expValue: 6,
    }));
    game.world.update(1 / 60);
    const upgradeId = game.getUpgradeChoices()[0].id;
    expect(game.chooseUpgrade(upgradeId)).toBe(true);
    game.world.player.hp = 50;
    game.world.player.exp = 4;
    game.world.player.level = 2;
    game.world.player.weaponStates.push({ id: 'stale-weapon' });
    game.world.projectiles.push({ active: true });
    game.world.experienceCrystals.push(new ExperienceCrystal({
      id: 'restart-crystal', x: 100, y: 100, expValue: 2,
    }));
    game.world.bossSystem.update(0, 270);
    game.world.enemies[0].hp = 0;
    game.world.enemies[0].alive = false;
    game.clock.advance(300);
    game.world.update(1 / 60);

    expect(game.stateManager.currentState).toBe(GAME_STATES.VICTORY);
    expect(game.restartGame()).toBe(true);
    expect(game.stateManager.currentState).toBe(GAME_STATES.PLAYING);
    expect(game.soundEnabled).toBe(false);
    expect(game.clock.elapsedSeconds).toBe(0);
    expect(game.world.enemies).toHaveLength(0);
    expect(game.world.projectiles).toHaveLength(0);
    expect(game.world.experienceCrystals).toHaveLength(0);
    expect(game.world.getRunResultSnapshot()).toBeNull();
    expect(game.getHudSnapshot().killCount).toBe(0);
    expect(game.world.player).toMatchObject({ hp: 100, maxHp: 100, exp: 0, level: 1, moveSpeed: 220 });
    expect(game.world.player.weaponStates.map((weapon) => weapon.id)).toEqual(['pulse-gun']);
    expect(game.world.upgradeSystem.getLevel(upgradeId)).toBe(0);
    expect(game.world.getBossSnapshot()).toBeNull();
  });
});
