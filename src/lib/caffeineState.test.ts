import { describe, it, expect } from 'vitest';
import {
  INITIAL_STATE,
  isActive,
  isTimed,
  isWhileApp,
  isExpired,
  describeDuration,
  type CoffeeState,
} from './caffeineState';

describe('CoffeeState — predicates', () => {
  it('INITIAL_STATE is idle', () => {
    expect(INITIAL_STATE).toEqual({ mode: 'idle' });
  });

  it('isActive returns false only for idle', () => {
    expect(isActive({ mode: 'idle' })).toBe(false);
    expect(isActive({ mode: 'indefinite', token: 't', startedAt: 0 })).toBe(true);
    expect(isActive({ mode: 'timed', token: 't', startedAt: 0, expiresAt: 1000, timerId: 'x' })).toBe(true);
    expect(
      isActive({ mode: 'while-app', token: 't', startedAt: 0, bundleId: 'com.app', appName: 'App' }),
    ).toBe(true);
  });

  it('isTimed / isWhileApp discriminate narrowly', () => {
    const timed: CoffeeState = { mode: 'timed', token: 't', startedAt: 0, expiresAt: 10, timerId: 'x' };
    const whileApp: CoffeeState = {
      mode: 'while-app', token: 't', startedAt: 0, bundleId: 'com.app', appName: 'App',
    };
    expect(isTimed(timed)).toBe(true);
    expect(isTimed(whileApp)).toBe(false);
    expect(isWhileApp(whileApp)).toBe(true);
    expect(isWhileApp(timed)).toBe(false);
  });
});

describe('CoffeeState — isExpired', () => {
  it('returns false for non-timed modes', () => {
    expect(isExpired({ mode: 'idle' }, 10_000)).toBe(false);
    expect(isExpired({ mode: 'indefinite', token: 't', startedAt: 0 }, 10_000)).toBe(false);
    expect(
      isExpired(
        { mode: 'while-app', token: 't', startedAt: 0, bundleId: 'com.app', appName: 'App' },
        10_000,
      ),
    ).toBe(false);
  });

  it('returns true only when now >= expiresAt for timed mode', () => {
    const state: CoffeeState = {
      mode: 'timed', token: 't', startedAt: 0, expiresAt: 1000, timerId: 'x',
    };
    expect(isExpired(state, 999)).toBe(false);
    expect(isExpired(state, 1000)).toBe(true);
    expect(isExpired(state, 10_000)).toBe(true);
  });
});

describe('describeDuration', () => {
  it('formats 0 and negatives as "0s"', () => {
    expect(describeDuration(0)).toBe('0s');
    expect(describeDuration(-1)).toBe('0s');
  });

  it('formats seconds only when under a minute', () => {
    expect(describeDuration(45_000)).toBe('45s');
  });

  it('formats minutes and seconds', () => {
    expect(describeDuration(65_000)).toBe('1m 5s');
  });

  it('omits seconds when evenly minutes', () => {
    expect(describeDuration(120_000)).toBe('2m');
  });

  it('formats hours without seconds for clean labels', () => {
    expect(describeDuration(3_600_000)).toBe('1h');
    expect(describeDuration(3_660_000)).toBe('1h 1m');
    expect(describeDuration(3_665_000)).toBe('1h 1m 5s');
  });
});
