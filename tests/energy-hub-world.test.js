import {describe,expect,it} from 'vitest';
import {GameWorld} from '../src/core/GameWorld.js';
import {Camera} from '../src/rendering/Camera.js';

describe('energy map boss world settlement',()=>{
 it('spawns at 270 and waits for 300 even after the new boss dies',()=>{const w=new GameWorld({camera:new Camera(),layoutRandom:()=>0});w.setMap('energy-hub');w.spawnSystem.update=()=>0;w.stateManager.startGame();w.clock.advance(270-1/60);w.update(1/60);expect(w.getBossSnapshot()).toMatchObject({typeId:'BOSS-02',alive:true});const boss=w.enemies.find(e=>e.category==='boss');w.enemyDamageSystem.applyDamage(boss,9999,'pulse-gun');w.update(1/60);expect(w.killCount).toBe(1);expect(w.stateManager.currentState).toBe('PLAYING');w.clock.advance(300-w.clock.elapsedSeconds);w.update(1/60);expect(w.stateManager.currentState).toBe('VICTORY');expect(w.getRunResultSnapshot().mapId).toBe('energy-hub');});
 it('runs legal optional events for each layout instead of skipping every anchor',()=>{for(const sample of [0,.5,.99]){const w=new GameWorld({camera:new Camera(),layoutRandom:()=>sample,encounterRandom:()=>0});w.setMap('energy-hub');w.encounterSystem.update(60,60,[...w.explorationSystem.getSnapshot().terminals,...w.relaySystem.getSnapshot(),...w.hazardSystem.getBlockedPoints()]);expect(w.encounterSystem.getSnapshot().active).not.toBe(null);}});
});
