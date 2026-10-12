import { LOGICAL_VIEWPORT } from '../config/worldConfig.js';
import { MapRenderer } from './MapRenderer.js';
import { PlayerRenderer } from './PlayerRenderer.js';
import { EnemyRenderer } from './EnemyRenderer.js';
import { ProjectileRenderer } from './ProjectileRenderer.js';
import { ExperienceCrystalRenderer } from './ExperienceCrystalRenderer.js';
import { OrbitalBladeRenderer } from './OrbitalBladeRenderer.js';
import { BossRenderer } from './BossRenderer.js';

export class CanvasRenderer {
  #canvas;
  #context;
  #camera;
  #mapRenderer;
  #projectileRenderer;
  #experienceCrystalRenderer;
  #enemyRenderer;
  #playerRenderer;
  #orbitalBladeRenderer;
  #bossRenderer;
  #windowTarget;
  #devicePixelRatio;
  #started = false;
  #scale = 1;
  #offsetX = 0;
  #offsetY = 0;
  #lastDevicePixelRatio = null;

  constructor({
    canvas,
    camera,
    mapRenderer = new MapRenderer(),
    experienceCrystalRenderer = new ExperienceCrystalRenderer(),
    projectileRenderer = new ProjectileRenderer(),
    enemyRenderer = new EnemyRenderer(),
    orbitalBladeRenderer = new OrbitalBladeRenderer(),
    bossRenderer = new BossRenderer(),
    playerRenderer = new PlayerRenderer(),
    windowTarget = globalThis.window ?? null,
    devicePixelRatio = () => globalThis.devicePixelRatio || 1,
  } = {}) {
    if (!canvas || typeof canvas.getContext !== 'function') {
      throw new TypeError('CanvasRenderer requires a Canvas element');
    }
    if (!camera || typeof camera.setViewport !== 'function') {
      throw new TypeError('CanvasRenderer requires a camera');
    }
    if (!mapRenderer || typeof mapRenderer.render !== 'function') {
      throw new TypeError('CanvasRenderer requires a map renderer');
    }
    if (!projectileRenderer || typeof projectileRenderer.render !== 'function') {
      throw new TypeError('CanvasRenderer requires a projectile renderer');
    }
    if (!experienceCrystalRenderer || typeof experienceCrystalRenderer.render !== 'function') {
      throw new TypeError('CanvasRenderer requires an experience crystal renderer');
    }
    if (!enemyRenderer || typeof enemyRenderer.render !== 'function') {
      throw new TypeError('CanvasRenderer requires an enemy renderer');
    }
    if (!playerRenderer || typeof playerRenderer.render !== 'function') {
      throw new TypeError('CanvasRenderer requires a player renderer');
    }
    if (!orbitalBladeRenderer || typeof orbitalBladeRenderer.render !== 'function') {
      throw new TypeError('CanvasRenderer requires an orbital blade renderer');
    }
    if (!bossRenderer || typeof bossRenderer.render !== 'function') {
      throw new TypeError('CanvasRenderer requires a Boss renderer');
    }
    if (typeof devicePixelRatio !== 'function') {
      throw new TypeError('devicePixelRatio must be provided as a function');
    }

    this.#canvas = canvas;
    this.#context = canvas.getContext('2d');
    if (!this.#context) throw new Error('Canvas 2D context is unavailable');
    this.#camera = camera;
    this.#mapRenderer = mapRenderer;
    this.#experienceCrystalRenderer = experienceCrystalRenderer;
    this.#projectileRenderer = projectileRenderer;
    this.#enemyRenderer = enemyRenderer;
    this.#orbitalBladeRenderer = orbitalBladeRenderer;
    this.#bossRenderer = bossRenderer;
    this.#playerRenderer = playerRenderer;
    this.#windowTarget = windowTarget;
    this.#devicePixelRatio = devicePixelRatio;
    this.resize();
  }

  start() {
    if (this.#started) return;
    this.#started = true;
    this.#windowTarget?.addEventListener('resize', this.#handleResize);
    this.resize();
  }

  stop() {
    if (!this.#started) return;
    this.#started = false;
    this.#windowTarget?.removeEventListener('resize', this.#handleResize);
  }

  resize() {
    const rect = this.#canvas.getBoundingClientRect();
    const cssWidth = Math.max(1, rect.width || this.#canvas.clientWidth || LOGICAL_VIEWPORT.width);
    const cssHeight = Math.max(1, rect.height || this.#canvas.clientHeight || LOGICAL_VIEWPORT.height);
    const ratio = this.#readDevicePixelRatio();
    const bitmapWidth = Math.max(1, Math.round(cssWidth * ratio));
    const bitmapHeight = Math.max(1, Math.round(cssHeight * ratio));

    if (this.#canvas.width !== bitmapWidth) this.#canvas.width = bitmapWidth;
    if (this.#canvas.height !== bitmapHeight) this.#canvas.height = bitmapHeight;

    this.#camera.setViewport(LOGICAL_VIEWPORT.width, LOGICAL_VIEWPORT.height);
    this.#scale = Math.min(
      bitmapWidth / LOGICAL_VIEWPORT.width,
      bitmapHeight / LOGICAL_VIEWPORT.height,
    );
    this.#offsetX = (bitmapWidth - LOGICAL_VIEWPORT.width * this.#scale) / 2;
    this.#offsetY = (bitmapHeight - LOGICAL_VIEWPORT.height * this.#scale) / 2;
    this.#lastDevicePixelRatio = ratio;
  }

  render(
    player = null,
    enemies = [],
    projectiles = [],
    experienceCrystals = [],
    orbitalBlade = null,
    bossSnapshot = null,
  ) {
    const ratio = this.#readDevicePixelRatio();
    if (ratio !== this.#lastDevicePixelRatio) this.resize();

    this.#context.setTransform(1, 0, 0, 1, 0, 0);
    this.#context.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
    this.#context.setTransform(this.#scale, 0, 0, this.#scale, this.#offsetX, this.#offsetY);
    this.#context.imageSmoothingEnabled = false;
    this.#camera.update();
    this.#mapRenderer.render(this.#context, this.#camera);
    this.#experienceCrystalRenderer.render(this.#context, this.#camera, experienceCrystals);
    this.#projectileRenderer.render(this.#context, this.#camera, projectiles);
    this.#bossRenderer.render(this.#context, this.#camera, bossSnapshot);
    this.#enemyRenderer.render(this.#context, this.#camera, enemies);
    this.#orbitalBladeRenderer.render(this.#context, this.#camera, orbitalBlade);
    if (player) this.#playerRenderer.render(this.#context, this.#camera, player);
  }

  #handleResize = () => {
    this.resize();
  };

  #readDevicePixelRatio() {
    const ratio = this.#devicePixelRatio();
    return Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
  }
}
