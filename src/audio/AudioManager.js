import { AUDIO_CONFIG } from '../config/audioConfig.js';

const VALID_WAVEFORMS = new Set(['sine', 'square', 'sawtooth', 'triangle']);

function resolveContextFactory() {
  const AudioContextConstructor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  return typeof AudioContextConstructor === 'function'
    ? () => new AudioContextConstructor()
    : null;
}

function validateConfig(config) {
  if (!config || typeof config !== 'object'
    || !Number.isFinite(config.defaultVolume) || config.defaultVolume < 0 || config.defaultVolume > 1
    || !Number.isSafeInteger(config.maxConcurrentVoices) || config.maxConcurrentVoices <= 0
    || !config.tones || typeof config.tones !== 'object') {
    throw new RangeError('Audio configuration contains invalid limits');
  }
  const tones = {};
  for (const [eventType, tone] of Object.entries(config.tones)) {
    if (!tone || !VALID_WAVEFORMS.has(tone.waveform)
      || !Number.isFinite(tone.startFrequencyHz) || tone.startFrequencyHz <= 0
      || !Number.isFinite(tone.endFrequencyHz) || tone.endFrequencyHz <= 0
      || !Number.isFinite(tone.durationSeconds) || tone.durationSeconds <= 0) {
      throw new RangeError(`Invalid audio tone for event: ${eventType}`);
    }
    tones[eventType] = Object.freeze({ ...tone });
  }
  return Object.freeze({
    defaultVolume: config.defaultVolume,
    maxConcurrentVoices: config.maxConcurrentVoices,
    tones: Object.freeze(tones),
  });
}

export class AudioManager {
  #config;
  #contextFactory;
  #context = null;
  #masterGain = null;
  #voices = new Set();
  #enabled = true;
  #volume;
  #disposed = false;

  constructor({ contextFactory = resolveContextFactory(), config = AUDIO_CONFIG } = {}) {
    if (contextFactory !== null && typeof contextFactory !== 'function') {
      throw new TypeError('Audio context factory must be a function or null');
    }
    this.#config = validateConfig(config);
    this.#contextFactory = contextFactory;
    this.#volume = this.#config.defaultVolume;
  }

  get enabled() {
    return this.#enabled;
  }

  get volume() {
    return this.#volume;
  }

  unlock() {
    if (this.#disposed || !this.#enabled || !this.#contextFactory) return false;
    if (this.#context && this.#masterGain) {
      return this.#resumeContext();
    }

    try {
      const context = this.#contextFactory();
      if (!context || typeof context.createGain !== 'function'
        || typeof context.createOscillator !== 'function'
        || !context.destination) return false;
      const masterGain = context.createGain();
      this.#context = context;
      this.#masterGain = masterGain;
      masterGain.gain.value = this.#volume;
      masterGain.connect(context.destination);
      if (!this.#resumeContext()) return false;
      return true;
    } catch {
      this.#releaseContext();
      return false;
    }
  }

  setEnabled(enabled) {
    if (typeof enabled !== 'boolean') throw new TypeError('Audio enabled state must be boolean');
    this.#enabled = enabled;
    this.#syncMasterGain();
    return this.#enabled;
  }

  setVolume(volume) {
    if (!Number.isFinite(volume) || volume < 0 || volume > 1) {
      throw new RangeError('Audio volume must be a finite value from 0 to 1');
    }
    this.#volume = volume;
    this.#syncMasterGain();
    return this.#volume;
  }

  playEvent(eventType) {
    if (this.#disposed || !this.#enabled || this.#volume === 0
      || !this.#context || !this.#masterGain
      || this.#voices.size >= this.#config.maxConcurrentVoices) return false;
    const tone = this.#config.tones[eventType];
    if (!tone) return false;

    let oscillator;
    let envelope;
    try {
      oscillator = this.#context.createOscillator();
      envelope = this.#context.createGain();
      const now = this.#context.currentTime;
      const end = now + tone.durationSeconds;
      oscillator.type = tone.waveform;
      oscillator.frequency.setValueAtTime(tone.startFrequencyHz, now);
      oscillator.frequency.exponentialRampToValueAtTime(tone.endFrequencyHz, end);
      envelope.gain.setValueAtTime(0.0001, now);
      envelope.gain.linearRampToValueAtTime(0.11, now + Math.min(0.012, tone.durationSeconds / 4));
      envelope.gain.exponentialRampToValueAtTime(0.0001, end);
      oscillator.connect(envelope);
      envelope.connect(this.#masterGain);
      oscillator.onended = () => {
        this.#voices.delete(oscillator);
        try {
          oscillator.disconnect();
          envelope.disconnect();
        } catch {
          // A finished voice is already silent; disconnect failures are harmless.
        }
      };
      this.#voices.add(oscillator);
      oscillator.start(now);
      oscillator.stop(end);
      return true;
    } catch {
      if (oscillator) this.#voices.delete(oscillator);
      try { oscillator?.disconnect(); } catch { /* API failure is a silent fallback. */ }
      try { envelope?.disconnect(); } catch { /* API failure is a silent fallback. */ }
      return false;
    }
  }

  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    for (const voice of this.#voices) {
      voice.onended = null;
      try { voice.stop(); } catch { /* Already stopped voices are harmless. */ }
      try { voice.disconnect(); } catch { /* API failure is a silent fallback. */ }
    }
    this.#voices.clear();
    this.#releaseContext();
  }

  #resumeContext() {
    if (typeof this.#context.resume !== 'function') return true;
    try {
      const result = this.#context.resume();
      result?.catch?.(() => this.#releaseContext());
      return true;
    } catch {
      this.#releaseContext();
      return false;
    }
  }

  #syncMasterGain() {
    if (this.#masterGain) this.#masterGain.gain.value = this.#enabled ? this.#volume : 0;
  }

  #releaseContext() {
    const context = this.#context;
    const masterGain = this.#masterGain;
    for (const voice of this.#voices) {
      voice.onended = null;
      try { voice.stop(); } catch { /* Already stopped voices are harmless. */ }
      try { voice.disconnect(); } catch { /* API failure is a silent fallback. */ }
    }
    try { masterGain?.disconnect(); } catch { /* Disconnection is best effort. */ }
    this.#context = null;
    this.#masterGain = null;
    this.#voices.clear();
    if (context && typeof context.close === 'function') {
      try { context.close()?.catch?.(() => {}); } catch { /* Closing is best effort. */ }
    }
  }
}
