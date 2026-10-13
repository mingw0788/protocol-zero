import { describe, it, expect } from 'vitest';
import { GameWorld } from '../src/core/GameWorld.js';
import { Camera } from '../src/rendering/Camera.js';
import { UpgradeSystem } from '../src/systems/UpgradeSystem.js';
import { Player } from '../src/entities/Player.js';

describe('upgrade rerolls', () => {
  it('guarantees an alternative even with deterministic randomness', () => {
    const system = new UpgradeSystem({ player: new Player(), random: () => 0 });
    const before = system.prepareChoices().map(c => c.id);
    expect(system.canReroll()).toBe(true);
    system.rerollChoices();
    const after = system.getChoicesSnapshot().map(c => c.id);
    expect(after.some(id => !before.includes(id))).toBe(true);
    expect(new Set(after).size).toBe(3);
  });

  it('disables rerolls when every eligible card is already shown', () => {
    const system = new UpgradeSystem({ player: new Player(), upgrades: [
      { id: 'only', name: 'Only', description: 'Only', maxLevel: 1 },
    ] });
    system.prepareChoices();
    expect(system.canReroll()).toBe(false);
    expect(system.rerollChoices()).toBe(false);
    system.select('only'); system.prepareChoices();
    expect(system.canReroll()).toBe(false);
  });

  it('spends only a reroll, keeps level choices paused, rejects other states and resets', () => {
    const w = new GameWorld({ camera: new Camera(), upgradeRandom: () => 0 });
    expect(w.rerollUpgrades()).toBe(false);
    w.stateManager.startGame(); w.player.exp = 6; w.update(1 / 60);
    expect(w.stateManager.currentState).toBe('LEVEL_UP');
    expect(w.rerollUpgrades()).toBe(true);
    expect(w.rerollUpgrades()).toBe(true);
    expect(w.rerollUpgrades()).toBe(false);
    expect(w.getUpgradeRerollSnapshot().remaining).toBe(0);
    expect(w.levelSystem.pendingLevelUps).toBe(1);
    w.chooseUpgrade(w.getUpgradeChoices()[0].id);
    expect(w.stateManager.currentState).toBe('PLAYING');
    w.stateManager.pause(); w.reset();
    expect(w.getUpgradeRerollSnapshot().remaining).toBe(2);
  });
});
