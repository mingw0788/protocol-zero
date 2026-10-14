import { GAME_STATES } from '../core/GameStateManager.js';
import { TacticalHUD } from './TacticalHUD.js';
import { SUPPLY_NAMES } from '../config/supplyConfig.js';

const WEAPON_LABELS = Object.freeze({ 'pulse-gun': '脉冲枪', 'orbital-blade': '轨道刃',
  'arc-coil': '弧光线圈', railgun: '磁轨炮' });
const ELEMENT_IDS = Object.freeze({
  menu: 'main-menu-panel',
  help: 'help-panel',
  hud: 'game-hud',
  pause: 'pause-panel',
  upgradePanel: 'upgrade-panel',
  upgradeTitle: 'upgrade-title',
  upgradeRemaining: 'upgrade-remaining',
  dialog: 'return-menu-dialog',
  start: 'start-game-button',
  showHelp: 'show-help-button',
  hideHelp: 'hide-help-button',
  sound: 'sound-toggle-button',
  soundVolume: 'sound-volume-slider',
  soundVolumeValue: 'sound-volume-value',
  highestKills: 'menu-highest-kills',
  bestVictoryTime: 'menu-best-victory-time',
  resume: 'resume-game-button',
  returnMenu: 'return-menu-button',
  confirmReturn: 'confirm-return-button',
  cancelReturn: 'cancel-return-button',
  healthText: 'hud-health-value',
  healthBar: 'hud-health-bar',
  experience: 'hud-experience',
  experienceBar: 'hud-experience-bar',
  level: 'hud-level',
  time: 'hud-time',
  kills: 'hud-kills',
  weapons: 'hud-weapons',
  bossHud: 'boss-hud',
  bossName: 'boss-name',
  bossHealthValue: 'boss-health-value',
  bossHealthBar: 'boss-health-bar',
  resultPanel: 'run-result-panel',
  resultTitle: 'run-result-title',
  resultKills: 'run-result-kills',
  resultTime: 'run-result-time',
  restartRun: 'restart-run-button',
  resultMenu: 'result-menu-button',
});
const UPGRADE_CHOICE_COUNT = 3;

function formatTime(elapsedSeconds) {
  const seconds = Math.floor(elapsedSeconds);
  return String(Math.floor(seconds / 60)).padStart(2, '0')
    + ':' + String(seconds % 60).padStart(2, '0');
}

export class UIManager {
  #root;
  #game;
  #windowTarget;
  #elements = {};
  #started = false;
  #unsubscribe = null;
  #removeListeners = [];
  #displayedChoices = Object.freeze([]);
  #tacticalHUD;

  constructor({ root, game, windowTarget = globalThis.window ?? null } = {}) {
    if (!root || typeof root.querySelector !== 'function') {
      throw new TypeError('UI root must be an element with querySelector');
    }
    if (!game?.stateManager
      || typeof game.getHudSnapshot !== 'function'
      || typeof game.getBossSnapshot !== 'function'
      || typeof game.getUpgradeChoices !== 'function'
      || typeof game.chooseUpgrade !== 'function'
      || typeof game.getRunResultSnapshot !== 'function'
      || typeof game.restartGame !== 'function'
      || typeof game.setSoundVolume !== 'function'
      || typeof game.getProgressSnapshot !== 'function'
      || !Number.isFinite(game.soundVolume)) {
      throw new TypeError('UIManager requires a game controller with state and HUD access');
    }
    this.#root = root;
    this.#tacticalHUD = new TacticalHUD(root);
    this.#elements.reroll = root.querySelector('#reroll-upgrades-button');
    this.#elements.expansion = root.querySelector('#expansion-hud');
    this.#elements.activeItemHud = root.querySelector('#active-item-hud');
    this.#elements.activeItemSlots = [0, 1].map((index) => root.querySelector(`#active-item-slot-${index}`));
    this.#elements.activeItemExchange = root.querySelector('#active-item-exchange');
    this.#game = game;
    this.#windowTarget = windowTarget;
    for (const [name, id] of Object.entries(ELEMENT_IDS)) {
      const element = root.querySelector('#' + id);
      if (!element) throw new Error('Missing required UI control: #' + id);
      this.#elements[name] = element;
    }
    this.#elements.upgradeChoiceButtons = [];
    this.#elements.upgradeChoiceNames = [];
    this.#elements.upgradeChoiceLevels = [];
    this.#elements.upgradeChoiceDescriptions = [];
    for (let index = 0; index < UPGRADE_CHOICE_COUNT; index += 1) {
      const slots = [
        ['upgradeChoiceButtons', `upgrade-choice-${index}`],
        ['upgradeChoiceNames', `upgrade-choice-${index}-name`],
        ['upgradeChoiceLevels', `upgrade-choice-${index}-level`],
        ['upgradeChoiceDescriptions', `upgrade-choice-${index}-description`],
      ];
      for (const [name, id] of slots) {
        const element = root.querySelector('#' + id);
        if (!element) throw new Error('Missing required UI control: #' + id);
        this.#elements[name].push(element);
      }
    }
  }

  start() {
    if (this.#started) return;
    this.#started = true;
    const e = this.#elements;
    if (e.reroll) this.#listen(e.reroll, 'click', () => this.#rerollUpgrades());
    const mapSelect = this.#root.querySelector('#map-select');
    if (mapSelect) this.#listen(mapSelect, 'change', () => {
      this.#game.selectMap(mapSelect.value);
      mapSelect.value = this.#game.getMapSnapshot().id;
    });
    const modeSelect = this.#root.querySelector('#mode-select');
    if (modeSelect) this.#listen(modeSelect, 'change', () => {
      this.#game.selectMode(modeSelect.value);
      modeSelect.value = this.#game.getRunConfigSnapshot().modeId;
    });
    this.#listen(e.start, 'click', () => this.#game.startGame());
    this.#listen(e.showHelp, 'click', () => this.#showHelp(true));
    this.#listen(e.hideHelp, 'click', () => this.#showHelp(false));
    this.#listen(e.sound, 'click', () => {
      this.#game.toggleSound();
      this.#renderSound();
    });
    this.#listen(e.soundVolume, 'input', () => {
      const volume = Number(e.soundVolume.value) / 100;
      this.#game.setSoundVolume(volume);
      this.#renderSound();
    });
    this.#listen(e.resume, 'click', () => this.#game.resume());
    this.#listen(e.restartRun, 'click', () => this.#game.restartGame());
    this.#listen(e.resultMenu, 'click', () => this.#game.returnToMenu());
    this.#listen(e.returnMenu, 'click', () => {
      if (this.#game.stateManager.currentState !== GAME_STATES.PAUSED || e.dialog.open) return;
      e.dialog.showModal();
    });
    this.#listen(e.cancelReturn, 'click', () => this.#cancelReturn());
    this.#listen(e.confirmReturn, 'click', () => {
      if (!e.dialog.open || this.#game.stateManager.currentState !== GAME_STATES.PAUSED) return;
      e.dialog.close();
      this.#game.returnToMenu();
    });
    for (let index = 0; index < UPGRADE_CHOICE_COUNT; index += 1) {
      this.#listen(e.upgradeChoiceButtons[index], 'click', () => this.#selectUpgrade(index));
    }
    this.#listen(e.dialog, 'cancel', (event) => {
      event.preventDefault();
      this.#cancelReturn();
    });
    if (this.#windowTarget) this.#listen(this.#windowTarget, 'keydown', this.#handleKeyDown);
    this.#unsubscribe = this.#game.stateManager.subscribe((state) => this.#renderState(state));
    this.#renderSound();
    this.#renderState(this.#game.stateManager.currentState);
  }

  stop() {
    if (!this.#started) return;
    this.#started = false;
    for (const remove of this.#removeListeners.splice(0)) remove();
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    if (this.#elements.dialog.open) this.#elements.dialog.close();
  }

  renderSnapshot(snapshot, currentState, bossSnapshot = this.#game.getBossSnapshot()) {
    this.#tacticalHUD.render(this.#game.getExpansionSnapshot?.(), currentState === GAME_STATES.PLAYING);
    this.#renderExpansion(currentState);
    this.#renderActiveItems(currentState);
    this.#renderBossSnapshot(bossSnapshot, currentState);
    this.#renderRunResult(currentState);
    this.#renderRecords();
    if (currentState !== GAME_STATES.PLAYING) return;
    const e = this.#elements;
    const danger = String(snapshot.health.current / snapshot.health.max <= .3);
    if (e.healthBar.getAttribute('data-danger') !== danger) e.healthBar.setAttribute('data-danger', danger);
    this.#setText(e.healthText, snapshot.health.current + ' / ' + snapshot.health.max);
    this.#setText(e.experience, `${Number(Number(snapshot.experience).toFixed(1))} / ${snapshot.experienceRequired}`);
    this.#setText(e.level, String(snapshot.level));
    this.#setText(e.time, formatTime(snapshot.elapsedSeconds));
    this.#setText(e.kills, String(snapshot.killCount));
    const build = this.#game.getExpansionSnapshot?.()?.build;
    const names = snapshot.weaponIds.map(id => build?.evolutions.find(evolution => evolution.weaponId === id && evolution.evolved)?.name ?? WEAPON_LABELS[id] ?? id);
    this.#setText(e.weapons, (names.join(' / ') || '无') + (build?.weaponLimit ? ` · ${build.weaponIds.length}/${build.weaponLimit} 栏` : ''));
    const orbitalBladeEquipped = String(snapshot.weaponIds.includes('orbital-blade'));
    if (e.weapons.getAttribute('data-orbital-blade') !== orbitalBladeEquipped) {
      e.weapons.setAttribute('data-orbital-blade', orbitalBladeEquipped);
    }
    if (e.healthBar.max !== snapshot.health.max) e.healthBar.max = snapshot.health.max;
    if (e.healthBar.value !== snapshot.health.current) e.healthBar.value = snapshot.health.current;
    if (e.experienceBar.max !== snapshot.experienceRequired) e.experienceBar.max = snapshot.experienceRequired;
    if (e.experienceBar.value !== snapshot.experience) e.experienceBar.value = snapshot.experience;
  }

  #renderBossSnapshot(snapshot, currentState) {
    const e = this.#elements;
    const isActive = currentState === GAME_STATES.PLAYING
      && snapshot?.alive === true
      && typeof snapshot.name === 'string'
      && snapshot.name.trim().length > 0
      && Number.isFinite(snapshot.hp)
      && Number.isFinite(snapshot.maxHp)
      && snapshot.maxHp > 0;
    e.bossHud.hidden = !isActive;
    if (!isActive) return;

    this.#setText(e.bossName, snapshot.name);
    this.#setText(e.bossHealthValue, snapshot.hp + ' / ' + snapshot.maxHp);
    if (e.bossHealthBar.max !== snapshot.maxHp) e.bossHealthBar.max = snapshot.maxHp;
    if (e.bossHealthBar.value !== snapshot.hp) e.bossHealthBar.value = snapshot.hp;
    const label = snapshot.name + '生命值';
    if (e.bossHealthBar.getAttribute('aria-label') !== label) {
      e.bossHealthBar.setAttribute('aria-label', label);
    }
  }

  #renderExpansion(state) {
    const element = this.#elements.expansion;
    if (!element) return;
    const snapshot = this.#game.getExpansionSnapshot?.();
    element.hidden = state !== GAME_STATES.PLAYING || !snapshot;
    if (element.hidden) return;
    const { supply, map } = snapshot;
    const parts = [map.name];
    const origin = snapshot.playerPosition;
    if (origin && snapshot.relays?.length) {
      const available = snapshot.relays
        .map(relay => ({ ...relay, distance: Math.hypot(relay.x - origin.x, relay.y - origin.y) }))
        .sort((a, b) => a.distance - b.distance);
      if (available.length) {
        const relay = available[0];
        parts.push(relay.energy < 100 ? `${relay.name} · 能量 ${relay.energy}% · 附近击杀补能`
          : relay.distance <= relay.radius ? `${relay.name} · 蓄能 ${Math.round(relay.progress * 100)}%`
            : `${relay.name} · 能量 ${relay.energy}%`);
      } else parts.push('中继站已全部耗尽');
    }
    if (supply.decoy) parts.push(`诱饵 ${Math.ceil(supply.decoy.remaining)}s`);
    if (supply.overclockRemaining > 0) parts.push(`过载 +30% · ${Math.ceil(supply.overclockRemaining)}s`);
    if (snapshot.relayBuff?.remaining > 0) parts.push(`火力中继 +${Math.round((snapshot.relayBuff.damageMultiplier - 1) * 100)}% · ${Math.ceil(snapshot.relayBuff.remaining)}s`);
    if (supply.scannerStacks > 0) parts.push(`扫描器 ${supply.scannerStacks}/3`);
    if (supply.station) parts.push(`救援补给 ${Math.ceil(supply.station.remaining)}s · 蓄能 ${Math.floor(supply.station.progress * 100)}%`);
    this.#setText(element, parts.join('  /  '));
  }

  #renderActiveItems(state) {
    const e = this.#elements;
    const hud = e.activeItemHud;
    if (!hud) return;
    const snapshot = this.#game.getExpansionSnapshot?.();
    hud.hidden = state !== GAME_STATES.PLAYING || !snapshot;
    if (hud.hidden) return;
    const { activeItems, selectedSlot, nearbyActivePickup } = snapshot.supply;
    hud.setAttribute('data-selected-slot', String(selectedSlot));
    for (let index = 0; index < e.activeItemSlots.length; index += 1) {
      const slot = e.activeItemSlots[index];
      if (!slot) continue;
      const type = activeItems?.[index] ?? null;
      this.#setText(slot, `${index === 0 ? 'E' : 'Q'} · ${type ? SUPPLY_NAMES[type] ?? type : '空槽'}`);
      slot.setAttribute('data-selected', String(selectedSlot === index));
    }
    if (e.activeItemExchange) {
      const hint = nearbyActivePickup
        ? `C 选槽 · F 换 ${SUPPLY_NAMES[nearbyActivePickup.type] ?? nearbyActivePickup.type}`
        : 'C 选槽 · F 交换';
      this.#setText(e.activeItemExchange, hint);
    }
  }

  #renderState(state) {
    const e = this.#elements;
    e.menu.hidden = state !== GAME_STATES.MENU;
    e.help.hidden = true;
    e.hud.hidden = state !== GAME_STATES.PLAYING;
    e.pause.hidden = state !== GAME_STATES.PAUSED;
    e.upgradePanel.hidden = state !== GAME_STATES.LEVEL_UP;
    e.bossHud.hidden = true;
    e.resultPanel.hidden = state !== GAME_STATES.VICTORY && state !== GAME_STATES.DEFEAT;
    if (state !== GAME_STATES.PAUSED && e.dialog.open) e.dialog.close();
    if (state === GAME_STATES.MENU) e.start.focus();
    if (state === GAME_STATES.PAUSED) e.resume.focus();
    if (state === GAME_STATES.LEVEL_UP) {
      this.#renderUpgradeChoices();
      this.#focusFirstUpgradeChoice();
    }
    if (state === GAME_STATES.VICTORY || state === GAME_STATES.DEFEAT) {
      this.#renderRunResult(state);
      e.restartRun.focus();
    }
    if (state === GAME_STATES.PLAYING) this.#root.focus();
    this.renderSnapshot(this.#game.getHudSnapshot(), state, this.#game.getBossSnapshot());
  }

  #renderUpgradeChoices() {
    const choices = this.#game.getUpgradeChoices();
    this.#displayedChoices = choices;
    const pendingLevelUps = this.#game.getHudSnapshot().pendingLevelUps;
    this.#setText(this.#elements.upgradeRemaining, `剩余升级选择：${pendingLevelUps}`);
    const guide = this.#root.querySelector('#evolution-guide');
    const build = this.#game.getExpansionSnapshot?.()?.build;
    if (guide && build) this.#setText(guide, build.evolutions.map(evolution => `${evolution.evolved ? '✓' : evolution.eligible ? '★' : '◇'} ${evolution.name}：${evolution.requirementText}`).join(' · '));
    const reroll = this.#elements.reroll;
    const rerollState = this.#game.getUpgradeRerollSnapshot?.();
    if (reroll && rerollState) {
      reroll.disabled = !rerollState.available;
      this.#setText(reroll, `R · 重抽选项（剩余 ${rerollState.remaining} 次）`);
    }

    for (let index = 0; index < UPGRADE_CHOICE_COUNT; index += 1) {
      const choice = choices[index];
      this.#elements.upgradeChoiceButtons[index].hidden = !choice;
      if (!choice) continue;
      this.#setText(this.#elements.upgradeChoiceNames[index], choice.name);
      const levelText = choice.type === 'evolution' ? '★ 武器进化 · 本局永久' : choice.repeatable
        ? '可重复恢复'
        : `等级 ${choice.currentLevel} → ${choice.targetLevel} / ${choice.maxLevel}`;
      this.#setText(this.#elements.upgradeChoiceLevels[index], levelText);
      this.#setText(this.#elements.upgradeChoiceDescriptions[index], choice.description);
    }
  }

  #focusFirstUpgradeChoice() {
    this.#elements.upgradeChoiceButtons.find((button) => !button.hidden)?.focus();
  }

  #renderRunResult(state) {
    if (state !== GAME_STATES.VICTORY && state !== GAME_STATES.DEFEAT) return;
    const snapshot = this.#game.getRunResultSnapshot();
    if (!snapshot) return;
    this.#setText(this.#elements.resultTitle, state === GAME_STATES.VICTORY ? '任务完成' : '任务失败');
    this.#setText(this.#elements.resultKills, String(snapshot.killCount));
    this.#setText(this.#elements.resultTime, formatTime(snapshot.elapsedSeconds));
    const detail = this.#root.querySelector('#run-result-exploration');
    const expansion = this.#game.getExpansionSnapshot?.();
    if (detail) this.#setText(detail, `档案 ${expansion?.exploration.completed ?? 0}/3 · 事件 ${expansion?.encounters.completed ?? 0}/2 · 拾取补给 ${expansion?.supply.collected ?? 0} 件`);
  }

  #rerollUpgrades() {
    if (!this.#game.rerollUpgrades?.()) return;
    this.#renderUpgradeChoices();
    this.#focusFirstUpgradeChoice();
  }

  #renderRecords() {
    const progress = this.#game.getProgressSnapshot();
    if (!progress) return;
    this.#setText(this.#elements.highestKills, String(progress.highestKillCount));
    this.#setText(
      this.#elements.bestVictoryTime,
      progress.bestVictorySeconds === null ? '尚无' : formatTime(progress.bestVictorySeconds),
    );
  }

  #selectUpgrade(index) {
    const choice = this.#displayedChoices[index];
    if (!choice || !this.#game.chooseUpgrade(choice.id)) return false;
    if (this.#game.stateManager.currentState === GAME_STATES.LEVEL_UP) {
      this.#renderUpgradeChoices();
      this.#focusFirstUpgradeChoice();
    }
    return true;
  }

  #showHelp(visible) {
    if (this.#game.stateManager.currentState !== GAME_STATES.MENU) return;
    this.#elements.menu.hidden = visible;
    this.#elements.help.hidden = !visible;
    (visible ? this.#elements.hideHelp : this.#elements.showHelp).focus();
  }

  #renderSound() {
    const e = this.#elements.sound;
    this.#setText(e, this.#game.soundEnabled ? '音效：开启' : '音效：关闭');
    e.setAttribute('aria-pressed', String(this.#game.soundEnabled));
    const percentage = Math.round(this.#game.soundVolume * 100);
    if (String(this.#elements.soundVolume.value) !== String(percentage)) {
      this.#elements.soundVolume.value = String(percentage);
    }
    this.#setText(this.#elements.soundVolumeValue, percentage + '%');
  }

  #cancelReturn() {
    if (!this.#elements.dialog.open) return;
    this.#elements.dialog.close();
    this.#elements.returnMenu.focus();
  }

  #handleKeyDown = (event) => {
    const state = this.#game.stateManager.currentState;
    if (state === GAME_STATES.VICTORY || state === GAME_STATES.DEFEAT) {
      if (event.code === 'Escape') {
        event.preventDefault();
        return;
      }
      if (event.code === 'Tab') {
        const first = this.#elements.restartRun;
        const last = this.#elements.resultMenu;
        const active = this.#windowTarget?.document?.activeElement;
        if ((event.shiftKey && active === first) || (!event.shiftKey && active === last)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
      }
      return;
    }
    if (state === GAME_STATES.LEVEL_UP) {
      if (/^(Digit|Numpad)[123]$/.test(event.code)) {
        event.preventDefault();
        if (!event.repeat) this.#selectUpgrade(Number(event.code.slice(-1)) - 1);
        return;
      }
      if (event.code === 'KeyR') {
        event.preventDefault();
        if (!event.repeat) this.#rerollUpgrades();
        return;
      }
      if (event.code === 'Escape') {
        event.preventDefault();
        return;
      }
      if (event.code === 'Tab') {
        const visibleButtons = this.#elements.upgradeChoiceButtons.filter((button) => !button.hidden);
        if (this.#elements.reroll && !this.#elements.reroll.disabled) visibleButtons.push(this.#elements.reroll);
        const first = visibleButtons[0];
        const last = visibleButtons.at(-1);
        const active = this.#windowTarget?.document?.activeElement;
        if ((event.shiftKey && active === first) || (!event.shiftKey && active === last)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
      }
      return;
    }
    if (event.code !== 'Escape' || event.repeat) return;
    if (this.#elements.dialog.open) {
      event.preventDefault();
      this.#cancelReturn();
      return;
    }
    if (state === GAME_STATES.PLAYING || state === GAME_STATES.PAUSED) {
      event.preventDefault();
      this.#game.togglePause();
    }
  };

  #listen(target, type, listener) {
    target.addEventListener(type, listener);
    this.#removeListeners.push(() => target.removeEventListener(type, listener));
  }

  #setText(element, text) {
    if (element.textContent !== text) element.textContent = text;
  }
}
