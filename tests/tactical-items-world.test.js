import { describe, expect, it, vi } from 'vitest';
import { GameWorld } from '../src/core/GameWorld.js';
import { Camera } from '../src/rendering/Camera.js';
import { EncounterSystem } from '../src/systems/EncounterSystem.js';
import { Player } from '../src/entities/Player.js';

describe('categorized event rewards',()=>{
 it.each([[0,'defense','turret-kit'],[.4,'transport','cryo-grenade'],[.8,'elite','cryo-grenade']])('uses the %s event pool independently of event selection',(sample,type,item)=>{
  const player=new Player(),enemies=[],onReward=vi.fn(),eventRandom=vi.fn(()=>sample),rewardRandom=vi.fn(()=>.99);
  const system=new EncounterSystem({player,enemies,random:eventRandom,rewardRandom,onReward,spawnElite:()=>({id:'elite'})});
  system.update(60,60);const event=system.getSnapshot().active;expect(event.type).toBe(type);
  if(type==='elite')system.notifyEnemyDeath({enemyId:'elite',x:event.x,y:event.y},61);
  else {for(let i=1;i<=1200&&system.getSnapshot().active;i++){Object.assign(player,{x:system.getSnapshot().active.x,y:system.getSnapshot().active.y});system.update(1/60,60+i/60);}}
  expect(onReward).toHaveBeenCalledTimes(1);expect(onReward.mock.calls[0][0].items).toEqual([item]);expect(rewardRandom).toHaveBeenCalledTimes(1);expect(eventRandom).toHaveBeenCalledTimes(2);
 });
});
describe('new item world integration',()=>{
 it('exchanges new active types, deploys both slots, freezes and resets',()=>{
  const w=new GameWorld({camera:new Camera()});w.spawnSystem.update=()=>0;w.stateManager.startGame();w.player.hp=50;
  w.supplySystem.addPickup('turret-kit',w.player.x,w.player.y);w.supplySystem.addPickup('healing-field',w.player.x,w.player.y);w.update(1/60);
  w.supplySystem.addPickup('cryo-grenade',w.player.x+40,w.player.y);w.supplySystem.selectSlot(1);expect(w.supplySystem.exchangeNearby()).toBe(true);expect(w.supplySystem.getSnapshot().activeItems).toEqual(['turret-kit','cryo-grenade']);
  w.supplySystem.exchangeNearby();expect(w.supplySystem.deploy(0)).toBe(true);expect(w.supplySystem.deploy(1)).toBe(true);w.update(1/60);
  expect(w.getExpansionSnapshot().deployables.turrets).toHaveLength(1);expect(w.getExpansionSnapshot().deployables.healingFields).toHaveLength(1);expect(w.player.hp).toBeGreaterThan(50);
  w.stateManager.pause();const before=w.getExpansionSnapshot();w.update(5);expect(w.getExpansionSnapshot()).toEqual(before);w.reset();expect(w.getExpansionSnapshot().deployables.turrets).toEqual([]);expect(w.getSupplySnapshot().amplifierArmed).toBe(false);
 });
});
