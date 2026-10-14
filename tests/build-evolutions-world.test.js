import { describe, expect, it } from 'vitest';
import { GameWorld } from '../src/core/GameWorld.js';
import { Camera } from '../src/rendering/Camera.js';
import { Enemy } from '../src/entities/Enemy.js';
import { LocalProgressSystem } from '../src/systems/LocalProgressSystem.js';

function generator() { let seed = 9; return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); }
function grantUpgrade(world, id) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (world.upgradeSystem.prepareChoices().some(choice => choice.id === id)) {
      const selection = world.upgradeSystem.select(id); world.upgradeEffectSystem.applySelection(selection); return;
    }
  }
  throw new Error(`Missing ${id}`);
}

describe('world build integration', () => {
  it('allows mode changes only in the menu and preserves the selected limit on restart', () => {
    const world = new GameWorld({ camera: new Camera() });
    expect(world.setMode('tactical')).toBe(true);
    expect(world.getRunConfigSnapshot()).toMatchObject({ modeId: 'tactical', weaponLimit: 3 });
    world.stateManager.startGame();
    expect(world.setMode('standard')).toBe(false);
    world.reset();
    expect(world.getExpansionSnapshot().build.weaponLimit).toBe(3);
  });

  it('consumes one queued choice for evolution and equips real splitting projectiles', () => {
    const world = new GameWorld({ camera: new Camera(), upgradeRandom: generator() });
    world.spawnSystem.update = () => 0;
    world.stateManager.startGame();
    for (let i = 0; i < 3; i++) grantUpgrade(world, 'UP-01');
    for (let i = 0; i < 2; i++) grantUpgrade(world, 'UP-03');
    world.player.exp = 6; world.update(1 / 60);
    expect(world.chooseUpgrade('EV-01')).toBe(true);
    expect(world.levelSystem.pendingLevelUps).toBe(0);
    world.enemies.push(new Enemy({ id: 'evolved-shot-target', x: world.player.x + 100, y: world.player.y }));
    world.update(1 / 60);
    expect(world.projectiles).toHaveLength(3);
    expect(world.projectiles.every(projectile => projectile.canSplit)).toBe(true);
    world.stateManager.pause(); world.reset();
    expect(world.getExpansionSnapshot().build.evolvedWeaponIds).toEqual([]);
  });

  it('keeps tactical records separate from legacy standard scores in the new save format', () => {
    const progress = new LocalProgressSystem();
    const before = progress.getSnapshot().highestKillCount;
    expect(progress.recordRun({ modeId: 'tactical', outcome: 'victory', killCount: 999, elapsedSeconds: 300 })).toBe(false);
    expect(progress.getSnapshot().highestKillCount).toBe(before);
    expect(progress.getRecord({ modeId: 'tactical' }).highestKillCount).toBe(999);
  });
});
