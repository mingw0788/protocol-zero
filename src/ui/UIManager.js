import { GAME_STATES } from '../core/GameStateManager.js';

const WEAPON_LABELS = Object.freeze({ 'pulse-gun': '脉冲枪' });
const ELEMENT_IDS = Object.freeze({
  menu: 'main-menu-panel',
  help: 'help-panel',
  hud: 'game-hud',
  pause: 'pause-panel',
  dialog: 'return-menu-dialog',
  start: 'start-game-button',
  showHelp: 'show-help-button',
  hideHelp: 'hide-help-button',
  sound: 'sound-toggle-button',
  resume: 'resume-game-button',
  returnMenu: 'return-menu-button',
  confirmReturn: 'confirm-return-button',
  cancelReturn: 'cancel-return-button',
  healthText: 'hud-health-value',
  healthBar: 'hud-health-bar',
  experience: 'hud-experience',
  level: 'hud-level',
  time: 'hud-time',
  kills: 'hud-kills',
  weapons: 'hud-weapons',
});

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

  constructor({ root, game, windowTarget = globalThis.window ?? null } = {}) {
    if (!root || typeof root.querySelector !== 'function') {
      throw new TypeError('UI root must be an element with querySelector');
    }
    if (!game?.stateManager || typeof game.getHudSnapshot !== 'function') {
      throw new TypeError('UIManager requires a game controller with state and HUD access');
    }
    this.#root = root;
    this.#game = game;
    this.#windowTarget = windowTarget;
    for (const [name, id] of Object.entries(ELEMENT_IDS)) {
      const element = root.querySelector('#' + id);
      if (!element) throw new Error('Missing required UI control: #' + id);
      this.#elements[name] = element;
    }
  }

  start() {
    if (this.#started) return;
    this.#started = true;
    const e = this.#elements;
    this.#listen(e.start, 'click', () => this.#game.startGame());
    this.#listen(e.showHelp, 'click', () => this.#showHelp(true));
    this.#listen(e.hideHelp, 'click', () => this.#showHelp(false));
    this.#listen(e.sound, 'click', () => {
      this.#game.toggleSound();
      this.#renderSound();
    });
    this.#listen(e.resume, 'click', () => this.#game.resume());
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

  renderSnapshot(snapshot, currentState) {
    if (currentState !== GAME_STATES.PLAYING) return;
    const e = this.#elements;
    this.#setText(e.healthText, snapshot.health.current + ' / ' + snapshot.health.max);
    this.#setText(e.experience, String(snapshot.experience));
    this.#setText(e.level, String(snapshot.level));
    this.#setText(e.time, formatTime(snapshot.elapsedSeconds));
    this.#setText(e.kills, String(snapshot.killCount));
    this.#setText(e.weapons, snapshot.weaponIds.map((id) => WEAPON_LABELS[id] ?? id).join(' / ') || '无');
    if (e.healthBar.max !== snapshot.health.max) e.healthBar.max = snapshot.health.max;
    if (e.healthBar.value !== snapshot.health.current) e.healthBar.value = snapshot.health.current;
  }

  #renderState(state) {
    const e = this.#elements;
    e.menu.hidden = state !== GAME_STATES.MENU;
    e.help.hidden = true;
    e.hud.hidden = state !== GAME_STATES.PLAYING;
    e.pause.hidden = state !== GAME_STATES.PAUSED;
    if (state !== GAME_STATES.PAUSED && e.dialog.open) e.dialog.close();
    if (state === GAME_STATES.MENU) e.start.focus();
    if (state === GAME_STATES.PAUSED) e.resume.focus();
    if (state === GAME_STATES.PLAYING) this.#root.focus();
    this.renderSnapshot(this.#game.getHudSnapshot(), state);
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
  }

  #cancelReturn() {
    if (!this.#elements.dialog.open) return;
    this.#elements.dialog.close();
    this.#elements.returnMenu.focus();
  }

  #handleKeyDown = (event) => {
    if (event.code !== 'Escape' || event.repeat) return;
    if (this.#elements.dialog.open) {
      event.preventDefault();
      this.#cancelReturn();
      return;
    }
    const state = this.#game.stateManager.currentState;
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
