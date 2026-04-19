import { describe, it, expect } from 'vitest';
import { toMillis, DurationError, type DurationInput } from './durationArgs';

describe('durationArgs.toMillis', () => {
  it('sums hours + minutes + seconds in ms', () => {
    expect(toMillis({ hours: 1, minutes: 2, seconds: 3 })).toBe(3_723_000);
  });

  it('accepts zero for any component', () => {
    expect(toMillis({ hours: 0, minutes: 30, seconds: 0 })).toBe(1_800_000);
  });

  it('coerces numeric strings', () => {
    expect(toMillis({ hours: '0', minutes: '5', seconds: '0' })).toBe(300_000);
  });

  it('throws DurationError when the total is zero', () => {
    expect(() => toMillis({ hours: 0, minutes: 0, seconds: 0 })).toThrow(DurationError);
    expect(() => toMillis({ hours: 0, minutes: 0, seconds: 0 })).toThrow(
      /at least one of hours/i,
    );
  });

  it('throws DurationError for negative components', () => {
    expect(() => toMillis({ hours: -1, minutes: 0, seconds: 0 })).toThrow(DurationError);
    expect(() => toMillis({ hours: 0, minutes: -1, seconds: 0 })).toThrow(DurationError);
    expect(() => toMillis({ hours: 0, minutes: 0, seconds: -1 })).toThrow(DurationError);
  });

  it('throws DurationError for non-finite components', () => {
    expect(() => toMillis({ hours: Number.NaN, minutes: 0, seconds: 0 })).toThrow(DurationError);
    expect(() => toMillis({ hours: Number.POSITIVE_INFINITY, minutes: 0, seconds: 0 })).toThrow(
      DurationError,
    );
  });

  it('throws DurationError for fractional components', () => {
    expect(() => toMillis({ hours: 1.5, minutes: 0, seconds: 0 })).toThrow(DurationError);
    expect(() => toMillis({ hours: 0, minutes: 0.5, seconds: 0 })).toThrow(DurationError);
  });

  it('caps at 24 hours total', () => {
    expect(() => toMillis({ hours: 25, minutes: 0, seconds: 0 })).toThrow(DurationError);
    expect(() => toMillis({ hours: 24, minutes: 0, seconds: 1 })).toThrow(DurationError);
    expect(toMillis({ hours: 24, minutes: 0, seconds: 0 })).toBe(86_400_000);
  });

  it('accepts partial input types', () => {
    const partial: DurationInput = { minutes: 45 };
    expect(toMillis(partial)).toBe(2_700_000);
  });
});
