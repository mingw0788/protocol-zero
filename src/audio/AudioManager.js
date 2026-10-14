import { AUDIO_CONFIG } from '../config/audioConfig.js';
import { MusicLayer } from './MusicLayer.js';

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
      || !Number.isFinite(tone.durationSeconds) || tone.durationSeconds <= 0
      || !Number.isFinite(tone.priority ?? 0) || (tone.priority ?? 0) < 0
      || !Number.isFinite(tone.peak ?? .11) || (tone.peak ?? .11) <= 0 || (tone.peak ?? .11) > .2
      || !Number.isFinite(tone.attackSeconds ?? .012) || (tone.attackSeconds ?? .012) <= 0
      || !Number.isFinite(tone.bodyFrequencyHz ?? tone.endFrequencyHz) || (tone.bodyFrequencyHz ?? tone.endFrequencyHz) <= 0) {
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
  #voiceDetails = new Map();
  #enabled = true;
  #volume;
  #disposed = false;
  #music = null;
  #musicVolume = .2;

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
    if (!enabled) this.#music?.stop();
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

  setMusicVolume(volume) {
    if (!Number.isFinite(volume) || volume < 0 || volume > 1) throw new RangeError('Invalid music volume');
    this.#musicVolume = volume;
    if (volume === 0) this.#music?.stop();
    return volume;
  }

  updateMusic({ elapsedSeconds = 0, active = false, intensity = 0 } = {}) {
    if (this.#disposed || !active || !this.#enabled || !this.#context || this.#musicVolume === 0) {
      this.#music?.stop(); return false;
    }
    try {
      this.#music ??= new MusicLayer({ context: this.#context });
      return this.#music.update({ elapsedSeconds, intensity, volume: this.#musicVolume });
    } catch { this.#music?.stop(); return false; }
  }

  playEvent(eventType) {
    if (this.#disposed || !this.#enabled || this.#volume === 0
      || !this.#context || !this.#masterGain) return false;
    const tone = this.#config.tones[eventType];
    if (!tone) return false;
    if (this.#voices.size >= this.#config.maxConcurrentVoices) {
      let victim = null;
      for (const voice of this.#voices) {
        const priority = this.#voiceDetails.get(voice)?.priority ?? 0;
        if (priority < (tone.priority ?? 0) && (!victim || priority < this.#voiceDetails.get(victim).priority)) victim = voice;
      }
      if (!victim) return false;
      this.#stopVoice(victim);
    }

    let oscillator;
    let envelope;
    try {
      oscillator = this.#context.createOscillator();
      envelope = this.#context.createGain();
      const now = this.#context.currentTime;
      const end = now + tone.durationSeconds;
      oscillator.type = tone.waveform;
      oscillator.frequency.setValueAtTime(tone.startFrequencyHz, now);
      if (tone.bodyFrequencyHz) oscillator.frequency.exponentialRampToValueAtTime(tone.bodyFrequencyHz, now + Math.min(.018, tone.durationSeconds / 3));
      oscillator.frequency.exponentialRampToValueAtTime(tone.endFrequencyHz, end);
      envelope.gain.setValueAtTime(0.0001, now);
      envelope.gain.linearRampToValueAtTime(tone.peak ?? .11, now + Math.min(tone.attackSeconds ?? .012, tone.durationSeconds / 4));
      envelope.gain.exponentialRampToValueAtTime(0.0001, end);
      oscillator.connect(envelope);
      envelope.connect(this.#masterGain);
      oscillator.onended = () => {
        this.#voices.delete(oscillator);
        this.#voiceDetails.delete(oscillator);
        try {
          oscillator.disconnect();
          envelope.disconnect();
        } catch {
          // A finished voice is already silent; disconnect failures are harmless.
        }
      };
      this.#voices.add(oscillator);
      this.#voiceDetails.set(oscillator, { priority: tone.priority ?? 0, envelope });
      oscillator.start(now);
      oscillator.stop(end);
      return true;
    } catch {
      if (oscillator) this.#voices.delete(oscillator);
      if (oscillator) this.#voiceDetails.delete(oscillator);
      try { oscillator?.disconnect(); } catch { /* API failure is a silent fallback. */ }
      try { envelope?.disconnect(); } catch { /* API failure is a silent fallback. */ }
      return false;
    }
  }

  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    for (const voice of [...this.#voices]) this.#stopVoice(voice);
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

  #stopVoice(voice) {
    voice.onended = null;
    try { voice.stop(); } catch { /* Already stopped. */ }
    try { voice.disconnect(); } catch { /* Best effort. */ }
    try { this.#voiceDetails.get(voice)?.envelope.disconnect(); } catch { /* Best effort. */ }
    this.#voices.delete(voice);
    this.#voiceDetails.delete(voice);
  }

  #syncMasterGain() {
    if (this.#masterGain) this.#masterGain.gain.value = this.#enabled ? this.#volume : 0;
  }

  #releaseContext() {
    this.#music?.stop(); this.#music = null;
    const context = this.#context;
    const masterGain = this.#masterGain;
    for (const voice of [...this.#voices]) this.#stopVoice(voice);
    try { masterGain?.disconnect(); } catch { /* Disconnection is best effort. */ }
    this.#context = null;
    this.#masterGain = null;
    this.#voices.clear();
    if (context && typeof context.close === 'function') {
      try { context.close()?.catch?.(() => {}); } catch { /* Closing is best effort. */ }
    }
  }
}
