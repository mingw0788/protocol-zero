export class GameClock {
  #elapsedSeconds = 0;

  get elapsedSeconds() {
    return this.#elapsedSeconds;
  }

  advance(deltaSeconds) {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
      throw new RangeError('Game clock delta must be a finite non-negative number');
    }

    this.#elapsedSeconds += deltaSeconds;
  }

  reset() {
    this.#elapsedSeconds = 0;
  }
}
