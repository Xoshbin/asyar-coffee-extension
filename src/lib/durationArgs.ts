export interface DurationInput {
  hours?: number | string;
  minutes?: number | string;
  seconds?: number | string;
}

export class DurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DurationError';
  }
}

const MAX_MS = 24 * 3600 * 1000;

function coerce(label: string, raw: number | string | undefined): number {
  if (raw === undefined || raw === '') return 0;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) {
    throw new DurationError(`${label} must be a finite number, got ${String(raw)}`);
  }
  if (n < 0) {
    throw new DurationError(`${label} must be non-negative, got ${n}`);
  }
  if (!Number.isInteger(n)) {
    throw new DurationError(`${label} must be a whole number, got ${n}`);
  }
  return n;
}

export function toMillis(input: DurationInput): number {
  const h = coerce('hours', input.hours);
  const m = coerce('minutes', input.minutes);
  const s = coerce('seconds', input.seconds);

  const totalMs = h * 3_600_000 + m * 60_000 + s * 1000;

  if (totalMs <= 0) {
    throw new DurationError(
      'Provide at least one of hours / minutes / seconds greater than zero.',
    );
  }
  if (totalMs > MAX_MS) {
    throw new DurationError('Duration must not exceed 24 hours.');
  }
  return totalMs;
}
