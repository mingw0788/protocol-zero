import { WEAPON_NAMES } from './buildSummary.js';
const symbols = { 'pulse-gun': '▸', 'orbital-blade': '◈', 'arc-coil': 'ϟ', railgun: '═', 'cryo-sprayer': '❄', 'drone-swarm': '◇' };
const setText = (element, text) => { if (element && element.textContent !== text) element.textContent = text; };
export class EquipmentHUD {
  #signature = ''; #cards = [];
  constructor(root) {
    this.panel = root.querySelector('#equipment-hud'); this.weapons = root.querySelector('#equipment-weapons');
    this.skill = root.querySelector('#use-skill-button'); this.skillBar = root.querySelector('#skill-cooldown-bar');
    this.title = root.querySelector('#equipment-title');
  }
  render(snapshot, visible) {
    if (!this.panel) return;
    this.panel.hidden = !visible || !snapshot?.expedition;
    if (this.panel.hidden) return;
    const data = snapshot.expedition, equipment = snapshot.equipment ?? [];
    setText(this.title, `${data.characterName.split(' · ')[0]} · ${data.difficultyName}${data.journeyId === 'campaign' ? ` · 第 ${data.stageIndex}/3 关` : ''}`);
    const signature = equipment.map(item => `${item.id}:${item.level}:${item.evolved}`).join('|');
    if (this.weapons && signature !== this.#signature) {
      this.#signature = signature; this.weapons.textContent = ''; this.#cards = [];
      for (const item of equipment) {
        const card = this.weapons.ownerDocument.createElement('div'); card.className = 'equipment-card';
        const name = this.weapons.ownerDocument.createElement('span'), cd = this.weapons.ownerDocument.createElement('span');
        const evolution = snapshot.build?.evolutions.find(e => e.weaponId === item.id && e.evolved);
        name.textContent = `${symbols[item.id] ?? '•'} ${evolution?.name ?? WEAPON_NAMES[item.id] ?? item.id} ${item.evolved ? '★' : item.id === 'pulse-gun' ? `+${item.level}` : `Lv${item.level}`}`;
        card.setAttribute('data-evolved', String(item.evolved)); card.appendChild(name); card.appendChild(cd); this.weapons.appendChild(card); this.#cards.push(cd);
      }
    }
    for (let index = 0; index < equipment.length; index++) {
      const item = equipment[index]; setText(this.#cards[index], item.continuous ? '持续环绕' : item.cooldownRemaining > .05 ? `CD ${item.cooldownRemaining.toFixed(1)}s` : '自动 · 就绪');
    }
    const remaining = data.skill.cooldownRemaining;
    setText(this.skill, `Space · ${data.skill.name} · ${remaining > .05 ? remaining.toFixed(1) + 's' : '就绪'}`);
    if (this.skill) this.skill.disabled = remaining > .05;
    if (this.skillBar) { this.skillBar.max = data.skill.cooldown; this.skillBar.value = Math.max(0, data.skill.cooldown - remaining); }
  }
}
