import { describe, it, expect } from 'vitest';
import { Player } from '../src/entities/Player.js';
import { DamageSystem } from '../src/systems/DamageSystem.js';
import { GameWorld } from '../src/core/GameWorld.js';
import { Camera } from '../src/rendering/Camera.js';
import { InputController } from '../src/input/InputController.js';
import { GameStateManager } from '../src/core/GameStateManager.js';
import { DashSystem } from '../src/systems/DashSystem.js';

describe('tactical movement and protection', () => {
  it('uses facing when stationary, clamps to the boundary and cannot dash during cooldown', () => {
    const player = new Player();
    const dash = new DashSystem({ player });
    player.x = player.worldWidth - player.radius - 1;
    player.facingX = 1; player.facingY = 0;
    dash.update(.18, { x: 0, y: 0 }, true);
    expect(player.x).toBe(player.worldWidth - player.radius);
    player.x = 100;
    expect(dash.update(.1, { x: -1, y: 0 }, true)).toBe(false);
    expect(player.x).toBe(100);
    dash.update(4, { x: 0, y: 0 }, false);
    expect(dash.update(1 / 60, { x: -1, y: 0 }, true)).toBe(true);
    expect(player.x).toBeCloseTo(89);
  });
  it('dashes diagonally at triple speed, freezes on pause and resets', () => {
    let request = true;
    const world = new GameWorld({ camera: new Camera(), inputController: {
      getMovementVector: () => ({ x: 1, y: 1 }), consumeDashPress: () => { const p = request; request = false; return p; },
    } });
    world.stateManager.startGame();
    const x = world.player.x;
    world.update(1 / 60);
    expect(world.player.x - x).toBeCloseTo(220 * 3 / 60 / Math.sqrt(2));
    expect(world.dashSystem.getSnapshot().cooldownRemaining).toBeGreaterThan(3.9);
    world.stateManager.pause();
    const before = world.dashSystem.getSnapshot();
    world.update(1);
    expect(world.dashSystem.getSnapshot()).toEqual(before);
    world.reset();
    expect(world.player.dashRemaining).toBe(0);
    expect(world.dashSystem.getSnapshot().cooldownRemaining).toBe(0);
  });

  it('absorbs damage with shield then applies overflow and contact immunity', () => {
    const player = new Player();
    const damage = new DamageSystem({ player });
    player.shield = 30;
    damage.applyContactDamage([{ contactDamage: 18 }]);
    expect(player.hp).toBe(100);
    expect(player.shield).toBe(12);
    damage.applyContactDamage([{ contactDamage: 18 }]);
    expect(player.shield).toBe(12);
    damage.update(.6);
    damage.applyContactDamage([{ contactDamage: 18 }]);
    expect(player.hp).toBe(94);
    expect(player.shield).toBe(0);
    damage.update(.6);
    player.dashRemaining = .1;
    expect(damage.applyContactDamage([{ contactDamage: 999 }]).damaged).toBe(false);
    expect(player.hp).toBe(94);
  });

  it('consumes Shift once, respects repeat and clears queued dash on pause', () => {
    const stateManager = new GameStateManager();
    const target = new EventTarget();
    const input = new InputController({ stateManager, windowTarget: target, documentTarget: null });
    const send = (type, code, repeat = false) => { const e = new Event(type); Object.assign(e, { code, repeat }); target.dispatchEvent(e); };
    input.start(); stateManager.startGame();
    send('keydown', 'ShiftLeft');
    expect(input.consumeDashPress()).toBe(true);
    send('keydown', 'ShiftLeft', true);
    send('keydown', 'ShiftRight');
    expect(input.consumeDashPress()).toBe(false);
    send('keyup', 'ShiftLeft'); send('keyup', 'ShiftRight');
    send('keydown', 'ShiftRight'); stateManager.pause();
    expect(input.consumeDashPress()).toBe(false);
    input.stop();
  });
});
