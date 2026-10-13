import { describe, it, expect } from 'vitest';
import { GameWorld } from '../src/core/GameWorld.js';
import { Camera } from '../src/rendering/Camera.js';
import { ExperienceCrystal } from '../src/entities/ExperienceCrystal.js';
import { Enemy } from '../src/entities/Enemy.js';

const create = () => { const w = new GameWorld({ camera: new Camera() }); w.stateManager.startGame(); return w; };
describe('exploration and supplies', () => {
  it('collects shield only below capacity and magnet gathers crystals only once', () => {
    const w = create(), p = w.player, s = w.supplySystem;
    s.addPickup('shield', p.x, p.y); s.update(.01, .01);
    expect(p.shield).toBe(30);
    s.addPickup('shield', p.x, p.y); s.update(.01, .02);
    expect(s.getSnapshot().pickups).toHaveLength(1);
    w.experienceCrystals.push(new ExperienceCrystal({ id: 'remote', x: 50, y: 50, expValue: 40 }));
    s.addPickup('magnet', p.x, p.y); w.update(1 / 60);
    expect(w.experienceCrystals).toHaveLength(0);
    expect(p.level).toBe(4);
    expect(w.levelSystem.pendingLevelUps).toBe(3);
    expect(w.experienceSystem.collectAll()).toBe(0);
    const time = w.clock.elapsedSeconds;
    for (let i = 0; i < 3; i++) {
      expect(w.stateManager.currentState).toBe('LEVEL_UP');
      w.update(10);
      expect(w.clock.elapsedSeconds).toBe(time);
      expect(w.chooseUpgrade(w.getUpgradeChoices()[0].id)).toBe(true);
    }
    expect(w.stateManager.currentState).toBe('PLAYING');
    expect(w.levelSystem.pendingLevelUps).toBe(0);
    expect(p.exp).toBe(10);
  });

  it('freezes terminal progress on pause and resets when switching maps', () => {
    const w = create();
    const terminal = w.explorationSystem.getSnapshot().terminals[0];
    Object.assign(w.player, { x: terminal.x, y: terminal.y });
    w.update(.5); w.stateManager.pause();
    const snapshot = w.explorationSystem.getSnapshot();
    w.update(10);
    expect(w.explorationSystem.getSnapshot()).toEqual(snapshot);
    w.reset(); w.stateManager.returnToMenu();
    w.setMap('east-city');
    expect(w.explorationSystem.getSnapshot().terminals[0].id).toBe('city-a');
    expect(w.explorationSystem.getSnapshot().terminals[0].progress).toBe(0);
  });

  it('drops every 15 normal kills once, excludes boss and caps entities', () => {
    const w = create();
    for (let i = 0; i < 15; i++) { const e = new Enemy({ id: `e-${i}`, x: 50, y: 50 }); e.hp = 0; e.alive = false; w.enemies.push(e); }
    w.update(1 / 60); w.update(1 / 60);
    expect(w.supplySystem.getSnapshot().pickups).toHaveLength(1);
    expect(w.supplySystem.getSnapshot().killsUntilDrop).toBe(15);
    w.supplySystem.notifyEnemyDeath({ category: 'boss', x: 50, y: 50 });
    expect(w.supplySystem.getSnapshot().killsUntilDrop).toBe(15);
    for (let i = 0; i < 30; i++) w.supplySystem.addPickup('shield', 0, 0);
    expect(w.supplySystem.getSnapshot().pickups).toHaveLength(24);
  });

  it('requires continuous upload and grants each terminal and completion only once', () => {
    const w = create(), system = w.explorationSystem;
    const terminals = system.getSnapshot().terminals;
    Object.assign(w.player, { x: terminals[0].x, y: terminals[0].y });
    system.update(1); w.player.x += 100; system.update(.1);
    expect(system.getSnapshot().terminals[0].progress).toBe(0);
    for (const t of terminals) {
      Object.assign(w.player, { x: t.x, y: t.y });
      system.update(2.5); system.update(10);
    }
    expect(w.player.exp).toBe(30);
    expect(w.getUpgradeRerollSnapshot().remaining).toBe(3);
    expect(system.getSnapshot().completed).toBe(3);
    w.stateManager.pause(); w.reset();
    expect(system.getSnapshot().completed).toBe(0);
    expect(w.player.exp).toBe(0);
    expect(w.supplySystem.getSnapshot().pickups).toHaveLength(0);
    expect(w.getUpgradeRerollSnapshot().remaining).toBe(2);
  });
});
