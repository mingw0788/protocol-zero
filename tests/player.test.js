import { describe, expect, it } from 'vitest';
import { Player } from '../src/entities/Player.js';

describe('Player', () => {
  it('starts at the map center with the approved movement defaults', () => {
    const player = new Player();

    expect(player.x).toBe(1200);
    expect(player.y).toBe(675);
    expect(player.moveSpeed).toBe(220);
    expect(player.radius).toBe(16);
  });

  it('moves cardinally and normalizes diagonal movement to the same speed', () => {
    const horizontalPlayer = new Player();
    const diagonalPlayer = new Player();

    horizontalPlayer.update({ x: 1, y: 0 }, 1);
    diagonalPlayer.update({ x: 1, y: 1 }, 1);

    expect(horizontalPlayer.x - 1200).toBe(220);
    expect(horizontalPlayer.y).toBe(675);
    expect(Math.hypot(diagonalPlayer.x - 1200, diagonalPlayer.y - 675)).toBeCloseTo(220);
    expect(diagonalPlayer.x - 1200).toBeCloseTo(diagonalPlayer.y - 675);
  });

  it('clamps the player center inside every map edge by the configured radius', () => {
    const player = new Player({ worldWidth: 1000, worldHeight: 800 });

    player.update({ x: -1, y: 0 }, 10);
    expect(player.x).toBe(16);

    player.update({ x: 0, y: -1 }, 10);
    expect(player.y).toBe(16);

    player.update({ x: 1, y: 0 }, 10);
    expect(player.x).toBe(984);

    player.update({ x: 0, y: 1 }, 10);
    expect(player.y).toBe(784);
  });

  it('does not move when input is neutral and returns to center on reset', () => {
    const player = new Player();
    player.update({ x: 0, y: 0 }, 1);
    player.update({ x: 1, y: 0 }, 0.5);

    player.reset();

    expect(player.x).toBe(1200);
    expect(player.y).toBe(675);
  });
});
