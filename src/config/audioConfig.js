const TONES = Object.freeze({
  'pulse-fire': Object.freeze({ waveform: 'sine', startFrequencyHz: 720, endFrequencyHz: 420, durationSeconds: 0.07 }),
  'enemy-death': Object.freeze({ waveform: 'square', startFrequencyHz: 280, endFrequencyHz: 520, durationSeconds: 0.09 }),
  'player-hit': Object.freeze({ waveform: 'sawtooth', startFrequencyHz: 190, endFrequencyHz: 95, durationSeconds: 0.14 }),
  'player-death': Object.freeze({ waveform: 'triangle', startFrequencyHz: 150, endFrequencyHz: 48, durationSeconds: 0.34 }),
  upgrade: Object.freeze({ waveform: 'triangle', startFrequencyHz: 440, endFrequencyHz: 880, durationSeconds: 0.22 }),
  victory: Object.freeze({ waveform: 'sine', startFrequencyHz: 523.25, endFrequencyHz: 1046.5, durationSeconds: 0.36 }),
  defeat: Object.freeze({ waveform: 'triangle', startFrequencyHz: 260, endFrequencyHz: 82.41, durationSeconds: 0.3 }),
});

export const AUDIO_CONFIG = Object.freeze({
  defaultVolume: 0.65,
  maxConcurrentVoices: 8,
  tones: TONES,
});
