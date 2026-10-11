import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/Game.js';
import { GAME_STATES } from '../src/core/GameStateManager.js';

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
      weaponIds: ['pulse-gun'],
      killCount: 0,
      elapsedSeconds: 0,
    });
    expect(game.startGame()).toBe(true);
    game.world.update(1);
    expect(game.clock.elapsedSeconds).toBe(1);
  });
});
