import { describe, expect, it } from 'vitest';
import { createRandomStream } from '../src/core/createRandomStream.js';

describe('createRandomStream', () => {
  it('produces repeatable values in the [0, 1) range for a fixed seed', () => {
    const first = createRandomStream(0x12345678);
    const second = createRandomStream(0x12345678);
    const firstValues = Array.from({ length: 5 }, () => first());
    const secondValues = Array.from({ length: 5 }, () => second());

    expect(firstValues).toEqual(secondValues);
    expect(firstValues.every((value) => Number.isFinite(value) && value >= 0 && value < 1)).toBe(true);
    expect(new Set(firstValues).size).toBeGreaterThan(1);
  });
});
