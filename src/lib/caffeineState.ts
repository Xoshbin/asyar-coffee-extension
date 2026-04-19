/**
 * State of the Coffee extension's keep-awake inhibitor.
 *
 * Tokens are opaque UUIDs issued by Rust-side IPowerService. Every non-idle
 * state carries a live token — the controller's invariant is "at most one
 * inhibitor is ever active, addressable by this token."
 */
export type CoffeeState =
  | { mode: 'idle' }
  | { mode: 'indefinite'; token: string; startedAt: number }
  | { mode: 'timed'; token: string; startedAt: number; expiresAt: number; timerId: string }
  | {
      mode: 'while-app';
      token: string;
      startedAt: number;
      bundleId: string;
      appName: string;
    };

export const INITIAL_STATE: CoffeeState = { mode: 'idle' };

export function isActive(state: CoffeeState): boolean {
  return state.mode !== 'idle';
}

export function isTimed(
  state: CoffeeState,
): state is Extract<CoffeeState, { mode: 'timed' }> {
  return state.mode === 'timed';
}

export function isWhileApp(
  state: CoffeeState,
): state is Extract<CoffeeState, { mode: 'while-app' }> {
  return state.mode === 'while-app';
}

export function isExpired(state: CoffeeState, nowMs: number): boolean {
  return isTimed(state) && nowMs >= state.expiresAt;
}

/**
 * Human-readable duration string used by tray text and notification bodies.
 * Seconds are shown only under a minute; above a minute, only non-zero
 * components make it into the label.
 */
export function describeDuration(totalMs: number): string {
  if (totalMs <= 0) return '0s';
  const totalSeconds = Math.floor(totalMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (totalSeconds < 60) return `${seconds}s`;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0) parts.push(`${seconds}s`);
  return parts.join(' ');
}
