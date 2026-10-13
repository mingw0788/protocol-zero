import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/Game.js';

describe('map selection', () => {
  it('selects maps only in the menu and preserves the selected map across resets', () => {
    const game = new Game({ loopOptions: { requestAnimationFrame: () => 1, cancelAnimationFrame() {} } });
    expect(game.getMapSnapshot().id).toBe('laboratory');
    expect(game.selectMap('unknown')).toBe(false);
    expect(game.selectMap('east-city')).toBe(true);
    expect(Object.isFrozen(game.getMapSnapshot())).toBe(true);
    game.startGame();
    expect(game.selectMap('laboratory')).toBe(false);
    game.pause();
    expect(game.selectMap('laboratory')).toBe(false);
    game.returnToMenu();
    expect(game.getMapSnapshot().id).toBe('east-city');
    game.startGame();
    expect(game.world.player.worldWidth).toBe(2400);
    expect(game.world.player.worldHeight).toBe(1350);
    game.stop();
  });
});
