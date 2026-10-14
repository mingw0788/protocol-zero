const ROOTS = Object.freeze([110, 130.81, 98, 146.83]);
const ARPEGGIO = Object.freeze([0, 7, 12, 3, 7, 10, 12, 7]);
export class MusicLayer {
  #voices = [];
  #lastBeat = -1;
  #output = null;
  constructor({ context } = {}) { this.context = context; }
  update({ elapsedSeconds, intensity = 0, volume = .2 } = {}) {
    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0 || !Number.isFinite(intensity) || intensity < 0 || intensity > 1
      || !Number.isFinite(volume) || volume < 0 || volume > 1) throw new RangeError('Invalid music update');
    if (volume === 0) { this.stop(); return false; }
    if (!this.#voices.length) {
      try {
        this.#output = this.context.createGain(); this.#output.connect(this.context.destination);
        for (const type of ['sine', 'triangle', 'sine']) {
          const oscillator = this.context.createOscillator(), gain = this.context.createGain();
          this.#voices.push({ oscillator, gain }); oscillator.type = type;
          oscillator.connect(gain); gain.connect(this.#output); gain.gain.value = 0; oscillator.start();
        }
      } catch { this.stop(); return false; }
    }
    this.#output.gain.value = volume;
    const beat = Math.floor(elapsedSeconds * 2);
    if (beat === this.#lastBeat) return true;
    this.#lastBeat = beat;
    const root = ROOTS[Math.floor(elapsedSeconds / 4) % ROOTS.length], now = this.context.currentTime;
    const frequencies = [root / 2, root * 1.5, root * 2 ** (ARPEGGIO[beat % ARPEGGIO.length] / 12)];
    const volumes = [.035, .012 + .006 * intensity, .014 + .012 * intensity];
    for (const [index, voice] of this.#voices.entries()) {
      voice.oscillator.frequency.setValueAtTime(frequencies[index], now);
      voice.gain.gain.cancelScheduledValues?.(now);
      voice.gain.gain.setValueAtTime(.0001, now);
      voice.gain.gain.linearRampToValueAtTime(volumes[index], now + .04);
      voice.gain.gain.exponentialRampToValueAtTime(.0001, now + .48);
    }
    return true;
  }
  stop() {
    for (const { oscillator, gain } of this.#voices) {
      try { oscillator.stop(); } catch { /* Already stopped. */ }
      try { oscillator.disconnect(); gain.disconnect(); } catch { /* Best effort. */ }
    }
    try { this.#output?.disconnect(); } catch { /* Best effort. */ }
    this.#voices = []; this.#output = null; this.#lastBeat = -1;
  }
}
