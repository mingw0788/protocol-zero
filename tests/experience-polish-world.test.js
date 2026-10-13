import { describe, expect, it } from 'vitest';
import { GameWorld } from '../src/core/GameWorld.js';
import { Camera } from '../src/rendering/Camera.js';

describe('Experience polish integration', () => {
  it('freezes relay progress and hit effects, settles pulse deaths once and resets map state', () => {
    const world = new GameWorld({ camera: new Camera() });
    world.setMap('east-city');
    world.stateManager.startGame();
    world.player.x = 620; world.player.y = 360; world.player.hp = 70;
    world.player.weaponStates = [];
    const target = { id: 'relay-target', typeId: 'EN-01', category: 'normal', x: 750, y: 360,
      radius: 16, hp: 30, speed: 0, alive: true, expDrop: 1, contactDamage: 10 };
    world.enemies.push(target);
    world.enemyDamageSystem.applyDamage(target, 1);
    world.update(1 / 60);
    const flash = target.hitFlashRemaining;
    const relays = world.getExpansionSnapshot().relays;
    const particles = world.getVisualEffectsSnapshot();
    world.stateManager.pause(); world.update(10);
    expect(target.hitFlashRemaining).toBe(flash);
    expect(world.getExpansionSnapshot().relays).toEqual(relays);
    expect(world.getVisualEffectsSnapshot()).toEqual(particles);
    world.stateManager.resume();
    const sounds = [];
    world.subscribeSoundEvent(e => sounds.push(e.type));
    for (let i = 0; i < 119; i++) world.update(1 / 60);
    expect(world.player.hp).toBe(85);
    expect(world.killCount).toBe(1);
    expect(world.experienceCrystals).toHaveLength(1);
    expect(sounds.filter(s => s === 'relay-pulse')).toHaveLength(1);
    world.update(1 / 60);
    expect(world.killCount).toBe(1);
    world.stateManager.pause(); world.reset();
    expect(world.getExpansionSnapshot().relays.every(s => !s.used && s.progress === 0)).toBe(true);
    expect(world.getVisualEffectsSnapshot()).toEqual([]);
    world.stateManager.returnToMenu(); world.setMap('laboratory');
    expect(world.getExpansionSnapshot().relays).toEqual([]);
  });

  it('emits dedicated weapon cues through legal unlocks and clears firing feedback on restart', () => {
    let sample = .76;
    const world = new GameWorld({ camera: new Camera(), upgradeRandom: () => sample });
    world.stateManager.startGame();
    world.player.exp = 6; world.update(1 / 60);
    expect(world.chooseUpgrade('UP-07')).toBe(true);
    sample = .99; world.player.exp = 10; world.update(1 / 60);
    expect(world.chooseUpgrade('UP-08')).toBe(true);
    world.enemies.push({ id: 'durable', typeId: 'EN-01', category: 'normal', x: world.player.x + 150,
      y: world.player.y, radius: 16, hp: 1000, alive: true, speed: 0, contactDamage: 10, expDrop: 1 });
    const sounds = [];
    world.subscribeSoundEvent(e => sounds.push(e.type));
    world.update(1 / 60);
    expect(sounds).toEqual(expect.arrayContaining(['arc-fire', 'rail-fire', 'pulse-fire']));
    expect(world.player.weaponStates.every(w => w.fireFlashRemaining > 0)).toBe(true);
    world.stateManager.pause();
    const remaining = world.player.weaponStates.map(w => w.fireFlashRemaining);
    world.update(10);
    expect(world.player.weaponStates.map(w => w.fireFlashRemaining)).toEqual(remaining);
    world.reset();
    expect(world.player.weaponStates.every(w => !w.fireFlashRemaining)).toBe(true);
  });

  it('restores city relay energy from a nearby world death event', () => {
    const world = new GameWorld({ camera: new Camera() });
    world.setMap('east-city'); world.stateManager.startGame();
    world.player.x = 620; world.player.y = 360;
    world.relaySystem.update(2);
    expect(world.getExpansionSnapshot().relays[0].energy).toBe(0);
    const enemy = { id: 'relay-victim', typeId: 'EN-01', category: 'normal', x: 800, y: 360,
      radius: 16, hp: 1, speed: 0, alive: true, expDrop: 0, contactDamage: 10 };
    world.enemies.push(enemy);
    world.enemyDamageSystem.applyDamage(enemy, 1);
    world.update(1/60);
    expect(world.killCount).toBe(1);
    expect(world.getExpansionSnapshot().relays[0].energy).toBe(25);
  });
});
