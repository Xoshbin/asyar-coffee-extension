export class UntilError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UntilError';
  }
}

const HHMM = /^([0-9]{1,2}):([0-9]{1,2})$/;

/**
 * Parse a HH:mm string (24-hour) and return an absolute fire-time relative
 * to `nowMs`. Wraps forward to tomorrow if the target is today-past or equal.
 */
export function parseHhmmToFireAt(nowMs: number, raw: string): number {
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new UntilError('Time is required.');
  }
  const match = HHMM.exec(raw.trim());
  if (!match) {
    throw new UntilError('Use 24-hour HH:mm — for example 09:30 or 23:59.');
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23) {
    throw new UntilError(`Hours must be 0–23, got ${hours}.`);
  }
  if (minutes < 0 || minutes > 59) {
    throw new UntilError(`Minutes must be 0–59, got ${minutes}.`);
  }

  const nowDate = new Date(nowMs);
  const target = new Date(
    nowDate.getFullYear(),
    nowDate.getMonth(),
    nowDate.getDate(),
    hours,
    minutes,
    0,
    0,
  );
  if (target.getTime() <= nowMs) {
    target.setDate(target.getDate() + 1);
  }
  return target.getTime();
}
