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

  it('preserves a custom base move speed and restores it on reset', () => {
    const player = new Player({ moveSpeed: 150 });
    player.moveSpeed = 240;

    player.reset();

    expect(player.baseMoveSpeed).toBe(150);
    expect(player.moveSpeed).toBe(150);
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

  it('owns the configured starting health, progression, and pulse gun state', () => {
    const player = new Player();

    expect(player.hp).toBe(100);
    expect(player.maxHp).toBe(100);
    expect(player.level).toBe(1);
    expect(player.exp).toBe(0);
    expect(player.weaponStates).toEqual([{ id: 'pulse-gun', cooldownRemaining: 0 }]);
  });

  it('tracks alive and invulnerability per player and resets them', () => {
    const player = new Player();
    const otherPlayer = new Player();

    expect(player.alive).toBe(true);
    expect(player.invulnerabilityRemaining).toBe(0);
    player.hp = 17;
    player.alive = false;
    player.invulnerabilityRemaining = 0.25;

    expect(otherPlayer.alive).toBe(true);
    expect(otherPlayer.invulnerabilityRemaining).toBe(0);

    player.reset();

    expect(player.hp).toBe(100);
    expect(player.alive).toBe(true);
    expect(player.invulnerabilityRemaining).toBe(0);
  });

  it('owns and resets an independent pulse gun cooldown', () => {
    const player = new Player();
    const otherPlayer = new Player();

    expect(player.weaponStates).toEqual([{ id: 'pulse-gun', cooldownRemaining: 0 }]);
    player.weaponStates[0].cooldownRemaining = 0.35;

    expect(otherPlayer.weaponStates[0].cooldownRemaining).toBe(0);
    player.reset();

    expect(player.weaponStates).toEqual([{ id: 'pulse-gun', cooldownRemaining: 0 }]);
    expect(player.weaponStates[0]).not.toBe(otherPlayer.weaponStates[0]);
  });

  it('restores run attributes without sharing equipment between players', () => {
    const player = new Player();
    const otherPlayer = new Player();
    player.update({ x: 1, y: 0 }, 1);
    player.hp = 12;
    player.maxHp = 140;
    player.level = 4;
    player.exp = 8;
    player.weaponStates = [{ id: 'orbital-blade' }];

    player.reset();
    player.weaponStates[0].id = 'changed-in-one-run';

    expect(player.x).toBe(1200);
    expect(player.y).toBe(675);
    expect(player.hp).toBe(100);
    expect(player.maxHp).toBe(100);
    expect(player.level).toBe(1);
    expect(player.exp).toBe(0);
    expect(otherPlayer.weaponStates).toEqual([{ id: 'pulse-gun', cooldownRemaining: 0 }]);
    player.reset();
    expect(player.weaponStates).toEqual([{ id: 'pulse-gun', cooldownRemaining: 0 }]);
  });
});
