import { LOGICAL_VIEWPORT, WORLD_MAP } from '../config/worldConfig.js';

function requirePositiveFinite(value, name) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number`);
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export class Camera {
  #target = null;
  #x = 0;
  #y = 0;

  constructor({
    worldWidth = WORLD_MAP.width,
    worldHeight = WORLD_MAP.height,
    viewportWidth = LOGICAL_VIEWPORT.width,
    viewportHeight = LOGICAL_VIEWPORT.height,
  } = {}) {
    requirePositiveFinite(worldWidth, 'worldWidth');
    requirePositiveFinite(worldHeight, 'worldHeight');
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
    requirePositiveFinite(this.viewportWidth, 'viewportWidth');
    requirePositiveFinite(this.viewportHeight, 'viewportHeight');
    this.update();
  }

  get x() {
    return this.#x;
  }

  get y() {
    return this.#y;
  }

  setViewport(width, height) {
    requirePositiveFinite(width, 'viewportWidth');
    requirePositiveFinite(height, 'viewportHeight');
    this.viewportWidth = width;
    this.viewportHeight = height;
    this.update();
  }

  follow(target) {
    if (target !== null && (!Number.isFinite(target?.x) || !Number.isFinite(target?.y))) {
      throw new TypeError('Camera target must have finite x and y coordinates');
    }

    this.#target = target;
    this.update();
  }

  update() {
    const targetX = this.#target?.x ?? this.worldWidth / 2;
    const targetY = this.#target?.y ?? this.worldHeight / 2;
    this.#x = this.#centeredOffset(targetX, this.viewportWidth, this.worldWidth);
    this.#y = this.#centeredOffset(targetY, this.viewportHeight, this.worldHeight);
  }

  worldToScreen(x, y) {
    return { x: x - this.#x, y: y - this.#y };
  }

  screenToWorld(x, y) {
    return { x: x + this.#x, y: y + this.#y };
  }

  #centeredOffset(targetPosition, viewportSize, worldSize) {
    if (worldSize <= viewportSize) return (worldSize - viewportSize) / 2;

    const desiredOffset = targetPosition - viewportSize / 2;
    return clamp(desiredOffset, 0, worldSize - viewportSize);
  }
}
