import { describe, expect, it, vi } from 'vitest';
import { Game } from '../src/core/Game.js';
import { Enemy } from '../src/entities/Enemy.js';

function createAudioDouble() {
  let volume = 0.65;
  return {
    get volume() { return volume; },
    unlock: vi.fn(() => true),
    setEnabled: vi.fn(),
    setVolume: vi.fn((next) => { volume = next; return volume; }),
    playEvent: vi.fn(),
    dispose: vi.fn(),
  };
}

function createGame(audioManager = createAudioDouble()) {
  const game = new Game({
    audioManager,
    loopOptions: {
      requestAnimationFrame: () => 1,
      cancelAnimationFrame: () => {},
      windowTarget: null,
      documentTarget: null,
    },
    inputOptions: { windowTarget: null, documentTarget: null },
  });
  return { game, audioManager };
}

describe('Game audio integration', () => {
  it('unlocks only from enabled user-start actions and retains mute/volume across run reset', () => {
    const { game, audioManager } = createGame();
    expect(audioManager.unlock).not.toHaveBeenCalled();
    game.toggleSound();
    expect(audioManager.setEnabled).toHaveBeenLastCalledWith(false);
    expect(audioManager.unlock).not.toHaveBeenCalled();
    game.setSoundVolume(0.4);
    expect(game.soundVolume).toBe(0.4);
    expect(audioManager.setVolume).toHaveBeenCalledWith(0.4);

    game.startGame();
    expect(audioManager.unlock).not.toHaveBeenCalled();
    game.toggleSound();
    expect(audioManager.setEnabled).toHaveBeenLastCalledWith(true);
    expect(audioManager.unlock).toHaveBeenCalledTimes(1);
    game.world.reset();
    expect(game.soundEnabled).toBe(true);
    expect(game.soundVolume).toBe(0.4);
    game.stop();
    expect(audioManager.dispose).toHaveBeenCalledTimes(1);
  });

  it('forwards actual world audio events and removes the listener when stopped', () => {
    const { game, audioManager } = createGame();
    game.startGame();
    game.world.enemies.push(new Enemy({
      id: 'audio-target',
      x: game.world.player.x + 100,
      y: game.world.player.y,
    }));
    game.world.update(1 / 60);
    expect(audioManager.playEvent).toHaveBeenCalledWith('pulse-fire');

    game.stop();
    audioManager.playEvent.mockClear();
    game.world.reset();
    game.stateManager.startGame();
    game.world.enemies.push(new Enemy({
      id: 'post-stop-target',
      x: game.world.player.x + 100,
      y: game.world.player.y,
    }));
    game.world.update(1 / 60);
    expect(audioManager.playEvent).not.toHaveBeenCalled();
  });

  it('isolates a broken audio event sink from game simulation', () => {
    const audioManager = createAudioDouble();
    audioManager.playEvent.mockImplementation(() => { throw new Error('audio device unavailable'); });
    const { game } = createGame(audioManager);
    game.startGame();
    game.world.enemies.push(new Enemy({
      id: 'broken-audio-target',
      x: game.world.player.x + 100,
      y: game.world.player.y,
    }));
    expect(() => game.world.update(1 / 60)).not.toThrow();
    expect(game.clock.elapsedSeconds).toBe(1 / 60);
  });
});
