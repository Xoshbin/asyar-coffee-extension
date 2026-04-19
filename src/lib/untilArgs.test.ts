import { describe, it, expect } from 'vitest';
import { parseHhmmToFireAt, UntilError } from './untilArgs';

function at(isoLocal: string): number {
  return new Date(isoLocal).getTime();
}

describe('untilArgs.parseHhmmToFireAt', () => {
  it('parses "09:30" as today 09:30 when now is earlier', () => {
    const now = at('2026-04-19T08:00:00');
    const fireAt = parseHhmmToFireAt(now, '09:30');
    expect(new Date(fireAt).getHours()).toBe(9);
    expect(new Date(fireAt).getMinutes()).toBe(30);
    expect(new Date(fireAt).getDate()).toBe(new Date(now).getDate());
  });

  it('wraps to tomorrow when target already passed today', () => {
    const now = at('2026-04-19T10:00:00');
    const fireAt = parseHhmmToFireAt(now, '09:30');
    expect(new Date(fireAt).getDate()).toBe(new Date(now).getDate() + 1);
  });

  it('wraps to tomorrow when target equals now exactly', () => {
    const now = at('2026-04-19T09:30:00');
    const fireAt = parseHhmmToFireAt(now, '09:30');
    expect(fireAt).toBeGreaterThan(now);
  });

  it('accepts single-digit hours/minutes', () => {
    const now = at('2026-04-19T08:00:00');
    const fireAt = parseHhmmToFireAt(now, '9:5');
    expect(new Date(fireAt).getHours()).toBe(9);
    expect(new Date(fireAt).getMinutes()).toBe(5);
  });

  it('accepts "23:59"', () => {
    const now = at('2026-04-19T10:00:00');
    const fireAt = parseHhmmToFireAt(now, '23:59');
    expect(new Date(fireAt).getHours()).toBe(23);
    expect(new Date(fireAt).getMinutes()).toBe(59);
  });

  it('rejects malformed input', () => {
    const now = at('2026-04-19T10:00:00');
    expect(() => parseHhmmToFireAt(now, '')).toThrow(UntilError);
    expect(() => parseHhmmToFireAt(now, '9am')).toThrow(UntilError);
    expect(() => parseHhmmToFireAt(now, '9:60')).toThrow(UntilError);
    expect(() => parseHhmmToFireAt(now, '24:00')).toThrow(UntilError);
    expect(() => parseHhmmToFireAt(now, '-1:00')).toThrow(UntilError);
    expect(() => parseHhmmToFireAt(now, '1:2:3')).toThrow(UntilError);
  });
});
