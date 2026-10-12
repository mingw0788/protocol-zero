export class GameClock {
  #elapsedSeconds = 0;
  #compensation = 0;

  get elapsedSeconds() {
    return this.#elapsedSeconds;
  }

  advance(deltaSeconds) {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
      throw new RangeError('Game clock delta must be a finite non-negative number');
    }

    if (deltaSeconds === 0) return;

    const adjustedDelta = deltaSeconds - this.#compensation;
    const nextElapsedSeconds = this.#elapsedSeconds + adjustedDelta;
    this.#compensation = (nextElapsedSeconds - this.#elapsedSeconds) - adjustedDelta;
    this.#elapsedSeconds = nextElapsedSeconds;
  }

  reset() {
    this.#elapsedSeconds = 0;
    this.#compensation = 0;
  }
}
