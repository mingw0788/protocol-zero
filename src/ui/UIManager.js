import { GAME_STATES } from '../core/GameStateManager.js';
import { TacticalHUD } from './TacticalHUD.js';
import { SUPPLY_NAMES } from '../config/supplyConfig.js';
import { formatBuildSummary, formatCombatSummary, WEAPON_NAMES } from './buildSummary.js';
import { OPENING_PROTOCOLS, CHALLENGES } from '../config/runConfig.js';
import { ACHIEVEMENTS, COSMETICS, DISCOVERY_IDS } from '../config/progressConfig.js';
import { ENEMY_CONFIG } from '../config/enemyConfig.js';

const WEAPON_LABELS = WEAPON_NAMES;
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
  #lastStatsResult = null;
  #lastLibraryProgress = null;
  #pendingImport = null;

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
    for (const [id, method, key] of [['protocol-select', 'selectProtocol', 'protocolId'], ['challenge-select', 'selectChallenge', 'challengeId']]) {
      const control = this.#root.querySelector(`#${id}`);
      if (control) this.#listen(control, 'change', () => { this.#game[method](control.value); control.value = this.#game.getRunConfigSnapshot()[key]; this.#renderRecords(); });
    }
    const cosmetic = this.#root.querySelector('#cosmetic-select');
    if (cosmetic) this.#listen(cosmetic, 'change', () => { this.#game.selectCosmetic?.(cosmetic.value); this.#renderRecords(); });
    const endless = this.#root.querySelector('#continue-endless-button');
    if (endless) this.#listen(endless, 'click', () => this.#game.continueEndless?.());
    const endEndless = this.#root.querySelector('#end-endless-button');
    if (endEndless) this.#listen(endEndless, 'click', () => this.#game.endEndless?.());
    const exportButton = this.#root.querySelector('#export-progress-button');
    if (exportButton) this.#listen(exportButton, 'click', () => this.#exportProgress());
    const importButton = this.#root.querySelector('#import-progress-button'), fileInput = this.#root.querySelector('#import-progress-file');
    if (importButton && fileInput) {
      this.#listen(importButton, 'click', () => fileInput.click());
      this.#listen(fileInput, 'change', () => this.#previewImport(fileInput));
    }
    const importDialog = this.#root.querySelector('#import-progress-dialog');
    const cancelImport = this.#root.querySelector('#cancel-import-button'), confirmImport = this.#root.querySelector('#confirm-import-button');
    if (cancelImport) this.#listen(cancelImport, 'click', () => { this.#pendingImport = null; importDialog.close(); });
    if (importDialog) this.#listen(importDialog, 'cancel', () => { this.#pendingImport = null; });
    if (confirmImport) this.#listen(confirmImport, 'click', () => {
      if (!this.#pendingImport || this.#game.stateManager.currentState !== GAME_STATES.MENU) return;
      const result = this.#game.importProgress(this.#pendingImport); this.#pendingImport = null; importDialog.close();
      this.#transferNotice(result?.ok ? result.saved ? '档案已导入并保存。' : '档案本次已应用，本机存储不可用，尚未保存。' : result?.reason ?? '导入未完成。');
      this.#renderRecords(); this.#renderSound(); this.#renderFeedback();
    });
    this.#listen(e.start, 'click', () => this.#game.startGame());
    for (const prefix of ['', 'pause-']) {
      for (const [id, key] of [['damage-numbers', 'showDamageNumbers'], ['reduced-flash', 'reducedFlash'], ['danger', 'strongDanger'], ['tutorial', 'showTutorial']]) {
        const control = this.#root.querySelector(`#${prefix}feedback-${id}`);
        if (control) this.#listen(control, 'change', () => { this.#game.setFeedbackSettings?.({ [key]: control.checked }); this.#renderFeedback(); });
      }
      const music = this.#root.querySelector(`#${prefix}music-volume-slider`);
      if (music) this.#listen(music, 'input', () => { this.#game.setFeedbackSettings?.({ musicVolume: Number(music.value) / 100 }); this.#renderFeedback(); });
    }
    const dismissTutorial = this.#root.querySelector('#dismiss-tutorial-button');
    if (dismissTutorial) this.#listen(dismissTutorial, 'click', () => { this.#game.setFeedbackSettings?.({ showTutorial: false }); this.#renderFeedback(); });
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
    const importDialog = this.#root.querySelector('#import-progress-dialog');
    if (importDialog?.open) importDialog.close();
    this.#pendingImport = null;
  }

  renderSnapshot(snapshot, currentState, bossSnapshot = this.#game.getBossSnapshot()) {
    this.#renderFeedback(currentState, snapshot);
    if (currentState === GAME_STATES.PAUSED) this.#renderBuild();
    const endEndlessButton = this.#root.querySelector('#end-endless-button');
    if (endEndlessButton) endEndlessButton.hidden = currentState !== GAME_STATES.PAUSED || !this.#game.getExpansionSnapshot?.()?.endless?.active;
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
    this.#setText(e.healthText, Number(snapshot.health.current.toFixed(1)) + ' / ' + snapshot.health.max);
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

    this.#setText(e.bossName, snapshot.name + (snapshot.combatStage ? ` · 阶段 ${snapshot.combatStage}` : ''));
    this.#setText(e.bossHealthValue, Number(snapshot.hp.toFixed(1)) + ' / ' + snapshot.maxHp);
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
    const parts = [map.name + (map.layoutName ? ` · ${map.layoutName}` : '')];
    if (snapshot.runConfig && snapshot.runConfig.protocolId !== 'standard') parts.push(snapshot.runConfig.protocolName);
    if (snapshot.runConfig && snapshot.runConfig.challengeId !== 'none') parts.push(snapshot.runConfig.challengeName);
    if (snapshot.endless?.active) parts.push(`无尽加时 ${formatTime(snapshot.endless.elapsedSeconds)} · 额外击杀 ${snapshot.endless.kills}`);
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
    if (state !== GAME_STATES.MENU) {
      const importDialog = this.#root.querySelector('#import-progress-dialog');
      if (importDialog?.open) importDialog.close(); this.#pendingImport = null;
    }
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
    this.#setText(this.#elements.resultTitle, snapshot.endless ? '加时结束 · 标准胜利已保留' : state === GAME_STATES.VICTORY ? '任务完成' : '任务失败');
    const endlessButton = this.#root.querySelector('#continue-endless-button');
    if (endlessButton) endlessButton.hidden = state !== GAME_STATES.VICTORY || snapshot.endless;
    this.#setText(this.#elements.resultKills, String(snapshot.killCount));
    this.#setText(this.#elements.resultTime, formatTime(snapshot.elapsedSeconds));
    const detail = this.#root.querySelector('#run-result-exploration');
    const expansion = this.#game.getExpansionSnapshot?.();
    if (detail) this.#setText(detail, `档案 ${expansion?.exploration.completed ?? 0}/3 · 事件 ${expansion?.encounters.completed ?? 0}/2 · 拾取补给 ${expansion?.supply.collected ?? 0} 件`);
    const table = this.#root.querySelector('#result-damage-body');
    const summaryElement = this.#root.querySelector('#result-combat-summary');
    if (table && summaryElement && this.#lastStatsResult !== snapshot) {
      this.#lastStatsResult = snapshot;
      const summary = formatCombatSummary(snapshot, expansion?.build);
      table.textContent = '';
      if (summary) {
        this.#setText(summaryElement, `有效伤害 ${summary.total.toFixed(1)} · DPS ${summary.dps.toFixed(1)} · 生命承伤 ${summary.received.toFixed(1)} · 护盾吸收 ${summary.shield.toFixed(1)}`);
        for (const row of summary.rows) {
          const tr = table.ownerDocument.createElement('tr');
          for (const text of [row.name, row.damage.toFixed(1), `${row.share.toFixed(1)}%`, String(row.kills)]) {
            const td = table.ownerDocument.createElement('td'); td.textContent = text; tr.appendChild(td);
          }
          table.appendChild(tr);
        }
      } else this.#setText(summaryElement, '尚无战斗统计');
    }
  }

  #renderBuild() {
    const data = this.#game.getExpansionSnapshot?.();
    const summary = formatBuildSummary(data);
    for (const [key, id] of [['weapons', 'pause-weapons'], ['upgrades', 'pause-upgrades'], ['buffs', 'pause-buffs']]) {
      const element = this.#root.querySelector(`#${id}`); if (element) this.#setText(element, summary[key]);
    }
  }

  #renderFeedback(state = this.#game.stateManager.currentState, hud = this.#game.getHudSnapshot()) {
    const settings = this.#game.getFeedbackSettings?.();
    if (!settings) return;
    for (const prefix of ['', 'pause-']) {
      for (const [id, key] of [['damage-numbers', 'showDamageNumbers'], ['reduced-flash', 'reducedFlash'], ['danger', 'strongDanger'], ['tutorial', 'showTutorial']]) {
        const control = this.#root.querySelector(`#${prefix}feedback-${id}`); if (control) control.checked = settings[key];
      }
      const music = this.#root.querySelector(`#${prefix}music-volume-slider`), value = this.#root.querySelector(`#${prefix}music-volume-value`);
      if (music) music.value = String(Math.round(settings.musicVolume * 100));
      if (value) this.#setText(value, `${Math.round(settings.musicVolume * 100)}%`);
      const notice = this.#root.querySelector(`#${prefix}feedback-save-notice`);
      if (notice) { notice.hidden = this.#game.feedbackSaved !== false; this.#setText(notice, '设置本次已生效，本机存储暂不可用或版本较新，尚未保存。'); }
    }
    const tip = this.#root.querySelector('#tutorial-tip'), text = this.#root.querySelector('#tutorial-tip-text');
    if (!tip || !text) return;
    tip.hidden = state !== GAME_STATES.PLAYING || !settings.showTutorial || hud.elapsedSeconds >= 60;
    if (!tip.hidden) this.#setText(text, hud.elapsedSeconds < 15 ? 'WASD 移动 · 靠近敌人自动攻击 · Shift 冲刺脱围'
      : hud.elapsedSeconds < 35 ? '拾取晶体积累经验 · 升级时查看武器进化条件 · E/Q 使用道具'
        : 'G 切换目标 · 探索终端获取补给 · 事件倒计时内完成可得额外奖励');
  }

  #rerollUpgrades() {
    if (!this.#game.rerollUpgrades?.()) return;
    this.#renderUpgradeChoices();
    this.#focusFirstUpgradeChoice();
  }

  #renderRecords() {
    const progress = this.#game.getProgressSnapshot();
    if (!progress) return;
    const config = this.#game.getRunConfigSnapshot?.();
    const record = progress.records?.find(item => item.key === config?.recordKey);
    this.#setText(this.#elements.highestKills, String(record?.highestKillCount ?? (progress.records ? 0 : progress.highestKillCount)));
    this.#setText(
      this.#elements.bestVictoryTime,
      (record?.bestVictorySeconds ?? (progress.records ? null : progress.bestVictorySeconds)) === null ? '尚无' : formatTime(record?.bestVictorySeconds ?? progress.bestVictorySeconds),
    );
    const saveNotice = this.#root.querySelector('#progress-save-notice');
    const status = this.#game.getProgressSaveStatus?.();
    if (saveNotice) { saveNotice.hidden = status?.saved !== false; this.#setText(saveNotice, status?.reason === 'future-version' ? '检测到较新存档版本，原始档案保留，本次记录尚未保存。' : '本机存储暂不可用，本次记录尚未保存；可导出备份。'); }
    const protocolDescription = this.#root.querySelector('#run-configuration-description');
    if (protocolDescription && config) this.#setText(protocolDescription, `${OPENING_PROTOCOLS.find(item => item.id === config.protocolId)?.description ?? ''} · ${CHALLENGES.find(item => item.id === config.challengeId)?.description ?? ''}`);
    const library = this.#root.querySelector('#local-library-content');
    const cosmeticSelect = this.#root.querySelector('#cosmetic-select');
    if (cosmeticSelect && progress.achievements) {
      cosmeticSelect.value = progress.cosmeticId;
      for (const option of Array.from(cosmeticSelect.options ?? [])) {
        const definition = COSMETICS.find(item => item.id === option.value);
        option.disabled = Boolean(definition?.achievement && !progress.achievements.includes(definition.achievement));
      }
    }
    if (!library || !progress.discoveries || this.#lastLibraryProgress === progress) return;
    this.#lastLibraryProgress = progress;
    const names = { ...Object.fromEntries(Object.values(ENEMY_CONFIG).filter(item => item.typeId).map(item => [item.typeId, item.name])),
      'EN-EVENT': '物资守卫', 'BOSS-01': '机械暴君', 'BOSS-02': '电网监护者', ...WEAPON_NAMES,
      'EV-01': '裂隙脉冲', 'EV-02': '磁暴轨道', 'EV-03': '雷暴网络', 'EV-04': '裂城磁轨',
      defense: '防守链路', transport: '运输追赶', elite: '物资精英', laboratory: '实验室', 'east-city': '东城区', 'energy-hub': '能源枢纽' };
    const labels = { enemies: '敌人', weapons: '武器', evolutions: '进化', events: '事件', maps: '地图' };
    const lines = Object.keys(DISCOVERY_IDS).map(key => `${labels[key]} ${progress.discoveries[key].length}/${DISCOVERY_IDS[key].length}：${progress.discoveries[key].map(id => names[id] ?? id).join('、') || '尚未发现'}`);
    lines.push(...ACHIEVEMENTS.map(item => `${progress.achievements.includes(item.id) ? '✓' : '□'} ${item.name} · ${item.description}`));
    lines.push(`历史基线：最高击杀 ${progress.highestKillCount} · 最佳通关 ${progress.bestVictorySeconds === null ? '尚无' : formatTime(progress.bestVictorySeconds)}`);
    this.#setText(library, lines.join('\n'));
  }

  #transferNotice(text) { const element = this.#root.querySelector('#progress-transfer-status'); if (element) this.#setText(element, text); }
  #exportProgress() {
    const raw = this.#game.exportProgress?.(); if (!raw) return;
    const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
    const button = this.#root.querySelector('#export-progress-button'), link = button.ownerDocument.createElement('a');
    link.href = url; link.download = 'protocol-zero-save.json'; link.click(); URL.revokeObjectURL(url);
    this.#transferNotice('已导出本机档案，不包含进行中的战局。');
  }
  async #previewImport(input) {
    const file = input.files?.[0]; input.value = '';
    if (!file) return;
    if (file.size > 65536) { this.#transferNotice('文件超过64KiB，未改变当前档案。'); return; }
    try {
      const raw = await file.text(), preview = this.#game.previewProgressImport(raw);
      if (this.#game.stateManager.currentState !== GAME_STATES.MENU) return;
      if (!preview) { this.#transferNotice('档案无效或版本不支持，未改变当前档案。'); return; }
      this.#pendingImport = raw;
      this.#setText(this.#root.querySelector('#import-progress-preview'), `将替换当前本机档案：${preview.progress.records.length} 组成绩、${preview.progress.achievements.length} 项成就及声音/显示设置。取消可保留现有档案。`);
      this.#root.querySelector('#import-progress-dialog').showModal();
    } catch { this.#transferNotice('文件无法读取，未改变当前档案。'); }
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
        const endlessButton = this.#root.querySelector('#continue-endless-button');
        const first = endlessButton && !endlessButton.hidden ? endlessButton : this.#elements.restartRun;
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
