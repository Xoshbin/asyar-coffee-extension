import type { InstalledApplication } from 'asyar-sdk/contracts';

/** Direction of a single keyboard step through the picker. */
export type SelectionMove = 'up' | 'down';

/** The three intents the picker acts on, derived from host-forwarded keys. */
export type PickerIntent = SelectionMove | 'select';

/** Shape shared by native and host-forwarded keyboard events. */
export interface KeyLike {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
}

/**
 * Translate a key event into a picker intent. Modified chords are ignored so
 * native text editing and the launcher's ⌘K action panel keep their keys.
 */
export function pickerIntent(event: KeyLike): PickerIntent | null {
  if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return null;
  switch (event.key) {
    case 'ArrowUp':
      return 'up';
    case 'ArrowDown':
      return 'down';
    case 'Enter':
      return 'select';
    default:
      return null;
  }
}

/** Filter UI-resident app data locally — no IPC round-trip per keystroke. */
export function filterApplications(
  apps: readonly InstalledApplication[],
  query: string,
): InstalledApplication[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...apps];
  return apps.filter(
    (app) =>
      app.name.toLowerCase().includes(q) || (app.bundleId ?? '').toLowerCase().includes(q),
  );
}

/** Move one row, wrapping at both ends so ↑/↓ never dead-ends. */
export function moveSelection(
  length: number,
  current: number,
  direction: SelectionMove,
): number {
  if (length <= 0) return -1;
  const delta = direction === 'down' ? 1 : -1;
  return (current + delta + length) % length;
}

/** Keep the highlight on a real row after the filtered list shrinks. */
export function clampIndex(length: number, index: number): number {
  if (length <= 0) return -1;
  return Math.min(Math.max(index, 0), length - 1);
}

/** Stable identity across the view → worker RPC (bundle id when available). */
export function applicationKey(app: InstalledApplication): string {
  return app.bundleId ?? app.name;
}

/** Muted second line: the identifier users recognise, then the install path. */
export function subtitleFor(app: InstalledApplication): string {
  return app.bundleId ?? app.path ?? '';
}

/** Quiet fallback tile when the scanner has no native icon for an app. */
export function initialFor(name: string): string {
  return name.trim()[0]?.toUpperCase() ?? '?';
}
