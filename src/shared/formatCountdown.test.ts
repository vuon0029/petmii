import { describe, it, expect } from 'vitest';
import { formatCountdown, formatAutonomousCountdown } from './formatCountdown';

describe('formatCountdown', () => {
  it('returns "0s" for 0', () => {
    expect(formatCountdown(0)).toBe('0s');
  });

  it('returns "0s" for negative values', () => {
    expect(formatCountdown(-100)).toBe('0s');
  });

  it('returns "1s" for 1000ms', () => {
    expect(formatCountdown(1000)).toBe('1s');
  });

  it('returns "42s" for 42000ms', () => {
    expect(formatCountdown(42000)).toBe('42s');
  });

  it('returns "59s" for 59999ms', () => {
    expect(formatCountdown(59999)).toBe('59s');
  });

  it('returns "1m 0s" for 60000ms', () => {
    expect(formatCountdown(60000)).toBe('1m 0s');
  });

  it('returns "1m 12s" for 72000ms', () => {
    expect(formatCountdown(72000)).toBe('1m 12s');
  });

  it('returns "5m 0s" for 300000ms', () => {
    expect(formatCountdown(300000)).toBe('5m 0s');
  });

  it('returns "10m 0s" for 600000ms', () => {
    expect(formatCountdown(600000)).toBe('10m 0s');
  });

  it('returns "20m 0s" for 1200000ms', () => {
    expect(formatCountdown(1200000)).toBe('20m 0s');
  });
});

describe('formatAutonomousCountdown', () => {
  it('returns "0:00" for 0 seconds', () => {
    expect(formatAutonomousCountdown(0)).toBe('0:00');
  });

  it('returns "0:42" for 42 seconds', () => {
    expect(formatAutonomousCountdown(42)).toBe('0:42');
  });

  it('returns "1:12" for 72 seconds', () => {
    expect(formatAutonomousCountdown(72)).toBe('1:12');
  });

  it('returns "1:00" for 60 seconds', () => {
    expect(formatAutonomousCountdown(60)).toBe('1:00');
  });

  it('returns "0:05" for 5 seconds', () => {
    expect(formatAutonomousCountdown(5)).toBe('0:05');
  });
});
