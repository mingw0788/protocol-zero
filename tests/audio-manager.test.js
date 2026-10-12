import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioManager } from '../src/audio/AudioManager.js';
import { AUDIO_CONFIG } from '../src/config/audioConfig.js';

function createAudioHarness({ state = 'suspended' } = {}) {
  const oscillators = [];
  const gains = [];
  const context = {
    state,
    currentTime: 4,
    destination: { id: 'destination' },
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    createGain: vi.fn(() => {
      const gain = {
        gain: {
          value: 1,
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
      gains.push(gain);
      return gain;
    }),
    createOscillator: vi.fn(() => {
      const oscillator = {
        type: '',
        frequency: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null,
      };
      oscillators.push(oscillator);
      return oscillator;
    }),
  };
  const contextFactory = vi.fn(() => context);
  return { context, contextFactory, oscillators, gains };
}

describe('AudioManager', () => {
  let harness;

  beforeEach(() => {
    harness = createAudioHarness();
  });

  it('does not create an AudioContext until explicitly unlocked by a user gesture', () => {
    const audio = new AudioManager({ contextFactory: harness.contextFactory });
    expect(harness.contextFactory).not.toHaveBeenCalled();
    expect(audio.playEvent('pulse-fire')).toBe(false);
    expect(harness.contextFactory).not.toHaveBeenCalled();
    expect(audio.unlock()).toBe(true);
    expect(harness.contextFactory).toHaveBeenCalledTimes(1);
    expect(harness.context.resume).toHaveBeenCalledTimes(1);
  });

  it('synthesizes configured short event tones through one volume-controlled master gain', () => {
    const audio = new AudioManager({ contextFactory: harness.contextFactory });
    audio.unlock();
    expect(audio.playEvent('pulse-fire')).toBe(true);
    expect(harness.oscillators).toHaveLength(1);
    const [oscillator] = harness.oscillators;
    const tone = AUDIO_CONFIG.tones['pulse-fire'];
    expect(oscillator.type).toBe(tone.waveform);
    expect(oscillator.frequency.setValueAtTime).toHaveBeenCalledWith(tone.startFrequencyHz, 4);
    expect(oscillator.frequency.exponentialRampToValueAtTime)
      .toHaveBeenCalledWith(tone.endFrequencyHz, 4 + tone.durationSeconds);
    expect(oscillator.stop).toHaveBeenCalledWith(4 + tone.durationSeconds);
    expect(oscillator.connect).toHaveBeenCalledWith(harness.gains[1]);
  });

  it('keeps mute separate from the chosen volume and validates volume bounds', () => {
    const audio = new AudioManager({ contextFactory: harness.contextFactory });
    audio.unlock();
    expect(audio.setVolume(0.25)).toBe(0.25);
    expect(harness.gains[0].gain.value).toBe(0.25);
    audio.setEnabled(false);
    expect(harness.gains[0].gain.value).toBe(0);
    expect(audio.volume).toBe(0.25);
    audio.setEnabled(true);
    expect(harness.gains[0].gain.value).toBe(0.25);
    expect(() => audio.setVolume(-0.01)).toThrow(RangeError);
    expect(() => audio.setVolume(1.01)).toThrow(RangeError);
  });

  it('drops excess events when the configured active voice cap is reached', () => {
    const audio = new AudioManager({ contextFactory: harness.contextFactory });
    audio.unlock();
    for (let index = 0; index < AUDIO_CONFIG.maxConcurrentVoices; index += 1) {
      expect(audio.playEvent('enemy-death')).toBe(true);
    }
    expect(audio.playEvent('enemy-death')).toBe(false);
    expect(harness.oscillators).toHaveLength(AUDIO_CONFIG.maxConcurrentVoices);
    harness.oscillators[0].onended();
    expect(audio.playEvent('enemy-death')).toBe(true);
  });

  it('silently degrades when Web Audio is unavailable or context creation/resume fails', () => {
    const unsupported = new AudioManager({ contextFactory: null });
    expect(unsupported.unlock()).toBe(false);
    expect(unsupported.playEvent('victory')).toBe(false);

    const creationFailure = new AudioManager({ contextFactory: () => { throw new Error('blocked'); } });
    expect(creationFailure.unlock()).toBe(false);
    expect(creationFailure.playEvent('defeat')).toBe(false);

    const failedResumeContext = createAudioHarness().context;
    failedResumeContext.resume.mockImplementation(() => { throw new Error('blocked'); });
    const resumeFailure = new AudioManager({ contextFactory: () => failedResumeContext });
    expect(resumeFailure.unlock()).toBe(false);
    expect(resumeFailure.playEvent('pulse-fire')).toBe(false);
  });

  it('releases voices and closes the context on disposal', () => {
    const audio = new AudioManager({ contextFactory: harness.contextFactory });
    audio.unlock();
    audio.playEvent('player-death');
    audio.dispose();
    expect(harness.context.close).toHaveBeenCalledTimes(1);
    expect(audio.playEvent('victory')).toBe(false);
    expect(audio.unlock()).toBe(false);
    expect(harness.oscillators[0].stop).toHaveBeenCalledTimes(2);
  });
});
