import { describe, it, expect } from 'vitest';
import {
  getCooldownRemainingMs,
  isActionOnCooldown,
  setCooldown,
  sanitizeCooldowns,
} from './cooldownUtils';
import type { PetActionCooldowns } from './actionTypes';

describe('getCooldownRemainingMs', () => {
  it('returns 0 when action has no cooldown (undefined)', () => {
    const cooldowns: PetActionCooldowns = {};
    expect(getCooldownRemainingMs(cooldowns, 'feed', 1000)).toBe(0);
  });

  it('returns 0 when cooldown is expired (timestamp in the past)', () => {
    const cooldowns: PetActionCooldowns = { feed: 500 };
    expect(getCooldownRemainingMs(cooldowns, 'feed', 1000)).toBe(0);
  });

  it('returns correct remaining ms when cooldown is active', () => {
    const cooldowns: PetActionCooldowns = { feed: 5000 };
    expect(getCooldownRemainingMs(cooldowns, 'feed', 3000)).toBe(2000);
  });

  it('never returns negative values', () => {
    const cooldowns: PetActionCooldowns = { play: 100 };
    expect(getCooldownRemainingMs(cooldowns, 'play', 9999)).toBe(0);
  });
});

describe('sanitizeCooldowns', () => {
  it('returns {} for null input', () => {
    expect(sanitizeCooldowns(null)).toEqual({});
  });

  it('returns {} for undefined input', () => {
    expect(sanitizeCooldowns(undefined)).toEqual({});
  });

  it('returns {} for non-object inputs', () => {
    expect(sanitizeCooldowns(42)).toEqual({});
    expect(sanitizeCooldowns('string')).toEqual({});
    expect(sanitizeCooldowns(true)).toEqual({});
  });

  it('discards NaN values', () => {
    expect(sanitizeCooldowns({ feed: NaN })).toEqual({});
  });

  it('discards Infinity values', () => {
    expect(sanitizeCooldowns({ feed: Infinity, play: -Infinity })).toEqual({});
  });

  it('discards negative values', () => {
    expect(sanitizeCooldowns({ feed: -100 })).toEqual({});
  });

  it('discards zero values', () => {
    expect(sanitizeCooldowns({ feed: 0 })).toEqual({});
  });

  it('discards non-number types (string, boolean)', () => {
    expect(sanitizeCooldowns({ feed: 'hello', play: true })).toEqual({});
  });

  it('preserves valid finite positive numbers', () => {
    expect(sanitizeCooldowns({ feed: 1000, play: 2000 })).toEqual({
      feed: 1000,
      play: 2000,
    });
  });

  it('only processes keys: feed, play, rest, clean (ignores unknown keys)', () => {
    const result = sanitizeCooldowns({
      feed: 1000,
      play: 2000,
      rest: 3000,
      clean: 4000,
      unknown: 5000,
      anotherKey: 6000,
    });
    expect(result).toEqual({
      feed: 1000,
      play: 2000,
      rest: 3000,
      clean: 4000,
    });
    expect(result).not.toHaveProperty('unknown');
    expect(result).not.toHaveProperty('anotherKey');
  });
});

describe('setCooldown', () => {
  it('returns new object with correct timestamp (now + durationMs)', () => {
    const cooldowns: PetActionCooldowns = {};
    const now = 1000;
    const duration = 5000;
    const result = setCooldown(cooldowns, 'feed', duration, now);
    expect(result.feed).toBe(6000);
  });

  it('does not mutate the input object', () => {
    const cooldowns: PetActionCooldowns = { play: 2000 };
    const original = { ...cooldowns };
    setCooldown(cooldowns, 'feed', 5000, 1000);
    expect(cooldowns).toEqual(original);
  });

  it('preserves other action cooldowns in the result', () => {
    const cooldowns: PetActionCooldowns = { play: 2000, rest: 3000 };
    const result = setCooldown(cooldowns, 'feed', 5000, 1000);
    expect(result).toEqual({ play: 2000, rest: 3000, feed: 6000 });
  });
});

describe('isActionOnCooldown', () => {
  it('returns false when no cooldown set', () => {
    const cooldowns: PetActionCooldowns = {};
    expect(isActionOnCooldown(cooldowns, 'feed', 1000)).toBe(false);
  });

  it('returns false when cooldown expired', () => {
    const cooldowns: PetActionCooldowns = { feed: 500 };
    expect(isActionOnCooldown(cooldowns, 'feed', 1000)).toBe(false);
  });

  it('returns true when cooldown active', () => {
    const cooldowns: PetActionCooldowns = { feed: 5000 };
    expect(isActionOnCooldown(cooldowns, 'feed', 3000)).toBe(true);
  });
});
