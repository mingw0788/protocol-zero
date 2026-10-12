let fallbackSeedSequence = 0;

function createSeed() {
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const values = new Uint32Array(1);
    globalThis.crypto.getRandomValues(values);
    return values[0];
  }

  fallbackSeedSequence = (fallbackSeedSequence + 1) >>> 0;
  const clockValue = Math.trunc((globalThis.performance?.now?.() ?? 0) * 1000);
  return (Date.now() ^ clockValue ^ Math.imul(fallbackSeedSequence, 0x9e3779b9)) >>> 0;
}

export function createRandomStream(seed = createSeed()) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError('Random stream seed must be an unsigned 32-bit integer');
  }

  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  };
}
