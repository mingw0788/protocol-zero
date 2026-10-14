import {describe,expect,it,vi} from 'vitest';
import {FeedbackSettingsSystem,FEEDBACK_STORAGE_KEY} from '../src/systems/FeedbackSettingsSystem.js';
import {DamageNumberSystem} from '../src/systems/DamageNumberSystem.js';
import {MusicLayer} from '../src/audio/MusicLayer.js';
import {formatCombatSummary,formatBuildSummary} from '../src/ui/buildSummary.js';
describe('feedback settings',()=>{
 it('validates and restores preferences while tolerating disabled storage',()=>{const values=new Map();const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};const s=new FeedbackSettingsSystem({storage});expect(s.update({reducedFlash:true,musicVolume:.4})).toBe(true);expect(new FeedbackSettingsSystem({storage}).getSnapshot()).toMatchObject({reducedFlash:true,musicVolume:.4});expect(s.update({musicVolume:2})).toBe(false);const disabled=new FeedbackSettingsSystem({storage:{getItem(){throw Error();},setItem(){throw Error();}}});expect(disabled.update({showDamageNumbers:false})).toBe(false);expect(disabled.getSnapshot().showDamageNumbers).toBe(false);});
 it('preserves an unknown future version in storage',()=>{const raw=JSON.stringify({version:99});const storage={getItem:()=>raw,setItem:vi.fn()};const s=new FeedbackSettingsSystem({storage});s.update({showTutorial:false});expect(storage.setItem).not.toHaveBeenCalled();});
});
describe('bounded actual damage text',()=>{
 it('merges rapid hits, caps text, freezes snapshots and expires',()=>{const s=new DamageNumberSystem();s.emit({targetId:'a',x:10,y:10,amount:12});s.emit({targetId:'a',x:10,y:10,amount:8});expect(s.getSnapshot()[0].amount).toBe(20);for(let i=0;i<100;i++)s.emit({targetId:'t'+i,x:10,y:10,amount:1});expect(s.getSnapshot()).toHaveLength(48);expect(Object.isFrozen(s.getSnapshot()[0])).toBe(true);s.update(.7);expect(s.getSnapshot()).toEqual([]);s.reset();});
});
describe('summary data',()=>{
 it('uses effective damage and shows evolved names without double counting',()=>{const result={elapsedSeconds:10,statistics:{totalDamageDealt:100,totalDamageReceived:12,totalShieldAbsorbed:30,damageBySource:[{sourceId:'pulse-gun',damage:75},{sourceId:'turret-kit',damage:25}],killsBySource:[{sourceId:'pulse-gun',kills:2}]}};const build={evolutions:[{weaponId:'pulse-gun',name:'裂隙脉冲',evolved:true}],weaponIds:['pulse-gun'],weaponLimit:3};const s=formatCombatSummary(result,build);expect(s.dps).toBe(10);expect(s.rows[0]).toMatchObject({name:'裂隙脉冲',share:75,kills:2});expect(formatBuildSummary({build,upgrades:[],supply:{overclockRemaining:2,amplifierArmed:true},relayBuff:{remaining:0},deployables:{turrets:[],healingFields:[]}}).buffs).toContain('增幅');});
});
describe('original bounded music',()=>{
 it('keeps three voices, updates the loop and stops every node',()=>{const nodes=[];const param=()=>({value:0,setValueAtTime:vi.fn(),linearRampToValueAtTime:vi.fn(),exponentialRampToValueAtTime:vi.fn(),cancelScheduledValues:vi.fn()});const ctx={currentTime:0,destination:{},createGain:()=>({gain:param(),connect:vi.fn(),disconnect:vi.fn()}),createOscillator:()=>{const n={frequency:param(),connect:vi.fn(),disconnect:vi.fn(),start:vi.fn(),stop:vi.fn()};nodes.push(n);return n;}};const music=new MusicLayer({context:ctx});for(let i=0;i<100;i++)music.update({elapsedSeconds:i/10,intensity:1,volume:.2});expect(nodes).toHaveLength(3);music.stop();expect(nodes.every(n=>n.stop.mock.calls.length===1&&n.disconnect.mock.calls.length===1)).toBe(true);});
});
