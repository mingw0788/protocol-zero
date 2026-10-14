import { describe, expect, it } from 'vitest';
import { GameWorld } from '../src/core/GameWorld.js';
import { Camera } from '../src/rendering/Camera.js';
import { Enemy } from '../src/entities/Enemy.js';
import { ENEMY_CONFIG } from '../src/config/enemyConfig.js';

function seeded() {let seed=17;return ()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);}
function pick(world,id){for(let i=0;i<200;i++){if(world.upgradeSystem.prepareChoices().some(c=>c.id===id)){world.upgradeEffectSystem.applySelection(world.upgradeSystem.select(id));return;}}throw Error(id);}

describe('six weapon world lifecycle',()=>{
  it('unlocks cryo and drones through queued upgrades, freezes and clears all state',()=>{
    let sample=.85;const w=new GameWorld({camera:new Camera(),upgradeRandom:()=>sample});w.spawnSystem.update=()=>0;w.stateManager.startGame();
    w.player.exp=6;w.update(1/60);expect(w.chooseUpgrade('UP-09')).toBe(true);
    sample=.95;w.player.exp=10;w.update(1/60);expect(w.chooseUpgrade('UP-10')).toBe(true);
    w.enemies.push(new Enemy({id:'target',x:w.player.x+100,y:w.player.y,config:ENEMY_CONFIG.EN03}));w.update(1/60);
    expect(w.getHudSnapshot().weaponIds).toEqual(expect.arrayContaining(['cryo-sprayer','drone-swarm']));
    expect(w.getExpansionSnapshot().cryo.length).toBeGreaterThan(0);expect(w.getExpansionSnapshot().drones.drones).toHaveLength(1);
    expect(w.enemies[0].slowMultiplier).toBe(.55);w.stateManager.pause();const before=w.getExpansionSnapshot();w.update(5);expect(w.getExpansionSnapshot()).toEqual(before);
    w.reset();expect(w.getExpansionSnapshot().drones.drones).toEqual([]);expect(w.getExpansionSnapshot().cryo).toEqual([]);expect(w.getHudSnapshot().weaponIds).toEqual(['pulse-gun']);
  });
  it('requires a scanner for the arc evolution and does not consume it',()=>{
    const w=new GameWorld({camera:new Camera(),upgradeRandom:seeded()});
    for(let i=0;i<5;i++)pick(w,'UP-07');
    expect(w.upgradeSystem.prepareChoices().some(c=>c.id==='EV-03')).toBe(false);
    w.supplySystem.addPickup('scanner',w.player.x,w.player.y);w.supplySystem.update(1/60,1/60);
    expect(w.upgradeSystem.prepareChoices().some(c=>c.id==='EV-03')).toBe(true);
    expect(w.upgradeSystem.select('EV-03')).toMatchObject({type:'evolution'});expect(w.supplySystem.scannerStacks).toBe(1);
  });
});
