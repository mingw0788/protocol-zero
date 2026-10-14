import { describe, expect, it } from 'vitest';
import { Player } from '../src/entities/Player.js';
import { Enemy } from '../src/entities/Enemy.js';
import { ENEMY_CONFIG } from '../src/config/enemyConfig.js';
import { BOSS_CONFIG } from '../src/config/bossConfig.js';
import { EnemyDamageSystem } from '../src/systems/EnemyDamageSystem.js';
import { EnemySystem } from '../src/systems/EnemySystem.js';
import { StatusEffectSystem } from '../src/systems/StatusEffectSystem.js';
import { CryoSystem } from '../src/systems/CryoSystem.js';
import { DroneSystem } from '../src/systems/DroneSystem.js';
import { ArcCoilSystem } from '../src/systems/ArcCoilSystem.js';
import { RailgunSystem } from '../src/systems/RailgunSystem.js';
function fixture(ids=['cryo-sprayer']) { const player=new Player();player.weaponStates.push(...ids.map(id=>({id,cooldownRemaining:0})));const enemies=[];const enemyDamageSystem=new EnemyDamageSystem();const statusSystem=new StatusEffectSystem({enemies});return {player,enemies,enemyDamageSystem,statusSystem}; }
const step={deltaSeconds:1/60,level:1,damageMultiplier:1,fireRateMultiplier:1};

describe('cryo and slow status',()=>{
  it('hits only the aimed cone and slows actual movement',()=>{const f=fixture();const a=new Enemy({id:'front',x:f.player.x+100,y:f.player.y});const b=new Enemy({id:'back',x:f.player.x-100,y:f.player.y});f.enemies.push(a,b);const s=new CryoSystem(f);expect(s.update(step)).toBe(1);expect(a.hp).toBe(21);expect(b.hp).toBe(30);expect(a.slowMultiplier).toBe(.55);const before=a.x;new EnemySystem(f).update(.1);expect(before-a.x).toBeCloseTo(4.4);expect(s.getSnapshot()).toHaveLength(1);s.reset();expect(s.getSnapshot()).toEqual([]);});
  it('expires stronger slow independently, limits bosses and resets',()=>{const f=fixture();const e=new Enemy({id:'slow',x:100,y:100});const boss=new Enemy({id:'boss',x:500,y:500,config:BOSS_CONFIG});f.enemies.push(e,boss);f.statusSystem.applySlow(e,{sourceId:'a',factor:.4,duration:1});f.statusSystem.applySlow(e,{sourceId:'b',factor:.7,duration:3});f.statusSystem.applySlow(boss,{sourceId:'a',factor:.2,duration:3});expect(e.slowMultiplier).toBe(.4);expect(boss.slowMultiplier).toBe(.85);f.statusSystem.update(1.1);expect(e.slowMultiplier).toBe(.7);f.statusSystem.reset();expect(e.slowMultiplier).toBe(1);expect(boss.slowMultiplier).toBe(1);});
});
describe('bounded drones',()=>{
  it('creates up to three visible drones and real nonrecursive bolts',()=>{const f=fixture(['drone-swarm']);f.enemies.push(new Enemy({id:'target',x:f.player.x+100,y:f.player.y,config:ENEMY_CONFIG.EN03}));const s=new DroneSystem(f);expect(s.update({...step,level:5})).toBe(3);expect(s.getSnapshot().drones).toHaveLength(3);expect(s.getSnapshot().bolts).toHaveLength(3);for(let i=0;i<30;i++)s.update({...step,level:5});expect(f.enemies[0].hp).toBeLessThan(100);expect(s.getSnapshot().bolts.length).toBeLessThanOrEqual(24);s.reset();expect(s.getSnapshot().drones).toEqual([]);expect(s.getSnapshot().bolts).toEqual([]);});
});
describe('final two evolutions',()=>{
  it('arcs once then explodes at the last chain target',()=>{const f=fixture(['arc-coil']);f.enemies.push(new Enemy({id:'a',x:f.player.x+100,y:f.player.y,config:ENEMY_CONFIG.EN03}),new Enemy({id:'b',x:f.player.x+160,y:f.player.y,config:ENEMY_CONFIG.EN03}));const s=new ArcCoilSystem(f);s.update({...step,level:5,evolved:true});expect(s.getSnapshot().filter(v=>v.shape==='blast')).toHaveLength(1);expect(f.enemies[0].hp).toBeCloseTo(100-16*1.48-12);});
  it('limits lingering rail hits globally across tracks and expires them',()=>{const f=fixture(['railgun']);const e=new Enemy({id:'a',x:f.player.x+150,y:f.player.y,config:ENEMY_CONFIG.EN03});f.enemies.push(e);const s=new RailgunSystem(f);s.update({...step,level:5,evolved:true});const before=e.hp;s.update({...step,level:5,evolved:true});expect(e.hp).toBe(before);expect(s.getFieldsSnapshot()).toHaveLength(1);for(let i=0;i<150;i++)s.update({...step,level:0,evolved:true});expect(s.getFieldsSnapshot()).toEqual([]);s.reset();});
});
