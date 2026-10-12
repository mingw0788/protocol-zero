import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/Game.js';
import { Enemy } from '../src/entities/Enemy.js';
import { LocalProgressSystem } from '../src/systems/LocalProgressSystem.js';
import { LocalProgressStore, SAVE_KEY, SAVE_VERSION } from '../src/persistence/LocalProgressStore.js';

function createStorage(initial = null) {
  const data = new Map(initial ? [[SAVE_KEY, JSON.stringify(initial)]] : []);
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
  };
}

function createGame({ storage = createStorage(), audioManager = null } = {}) {
  return new Game({
    audioManager: audioManager ?? undefined,
    progressSystem: new LocalProgressSystem({ store: new LocalProgressStore({ storage }) }),
    loopOptions: {
      requestAnimationFrame: () => 1,
      cancelAnimationFrame: () => {},
      windowTarget: null,
      documentTarget: null,
    },
    inputOptions: { windowTarget: null, documentTarget: null },
  });
}

describe('Game local progress integration', () => {
  it('restores audio settings before menu use and saves changes immediately', () => {
    const storage = createStorage({
      version: SAVE_VERSION,
      highestKillCount: 4,
      bestVictorySeconds: 315,
      soundEnabled: false,
      soundVolume: 0.3,
    });
    const game = createGame({ storage });
    expect(game.soundEnabled).toBe(false);
    expect(game.soundVolume).toBe(0.3);
    expect(game.getProgressSnapshot()).toMatchObject({ highestKillCount: 4, bestVictorySeconds: 315 });
    game.setSoundVolume(0.5);
    expect(JSON.parse(storage.data.get(SAVE_KEY)).soundVolume).toBe(0.5);
    game.toggleSound();
    expect(JSON.parse(storage.data.get(SAVE_KEY)).soundEnabled).toBe(true);
    game.stop();
  });

  it('records only once at terminal settlement; defeats raise kills without changing best victory time', () => {
    const storage = createStorage();
    const game = createGame({ storage });
    game.startGame();
    game.world.bossSystem.update(0, 270);
    const boss = game.world.enemies.find(({ category }) => category === 'boss');
    boss.hp = 0;
    boss.alive = false;
    game.world.clock.advance(300);
    game.world.update(1 / 60);
    expect(game.stateManager.currentState).toBe('VICTORY');
    expect(game.getProgressSnapshot()).toMatchObject({ highestKillCount: 1, bestVictorySeconds: 300 + 1 / 60 });
    const victoryStored = JSON.parse(storage.data.get(SAVE_KEY));
    game.world.update(1 / 60);
    expect(JSON.parse(storage.data.get(SAVE_KEY))).toEqual(victoryStored);

    game.restartGame();
    game.world.player.hp = 10;
    game.world.enemies.push(new Enemy({
      id: 'record-defeat', x: game.world.player.x + 30, y: game.world.player.y,
    }));
    game.world.update(1 / 60);
    expect(game.stateManager.currentState).toBe('DEFEAT');
    expect(game.getProgressSnapshot()).toMatchObject({ highestKillCount: 1, bestVictorySeconds: 300 + 1 / 60 });
    expect(JSON.parse(storage.data.get(SAVE_KEY))).toMatchObject({ highestKillCount: 1, bestVictorySeconds: 300 + 1 / 60 });
    game.stop();
  });

  it('does not write intermediate run state and keeps progress across a clean restart', () => {
    const storage = createStorage();
    const game = createGame({ storage });
    game.startGame();
    game.world.recordKill();
    game.world.player.hp = 23;
    game.world.clock.advance(20);
    expect(storage.data.size).toBe(0);
    game.stop();
    expect(storage.data.size).toBe(0);
  });
});
