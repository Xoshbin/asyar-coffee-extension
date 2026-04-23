import type { IStatusBarItem } from 'asyar-sdk/contracts';
import { describeDuration, isTimed, isWhileApp, type CoffeeState } from './caffeineState';

export const TRAY_ITEM_ID = 'coffee-tray';

export interface TrayPrefs {
  hideTrayWhenIdle: boolean;
}

/**
 * Pure render function. Null means the tray should be unregistered entirely
 * (respects `hideTrayWhenIdle` when state is idle).
 *
 * Submenu shape:
 *   idle   → header + "Caffeinate"
 *   active → header + remaining-line (if timed) + "Decaffeinate"
 */
export function renderTrayMenu(
  state: CoffeeState,
  prefs: TrayPrefs,
  nowMs: number,
): IStatusBarItem | null {
  if (state.mode === 'idle') {
    if (prefs.hideTrayWhenIdle) return null;
    return {
      id: TRAY_ITEM_ID,
      icon: '💤',
      text: 'Decaffeinated',
      submenu: [
        { id: 'header-idle', text: 'Your mac is decaffeinated', enabled: false },
        { id: 'caffeinate', text: 'Caffeinate' },
      ],
    };
  }

  const text = topLevelText(state, nowMs);
  const submenu: IStatusBarItem[] = [
    { id: 'header-active', text: 'Your mac is caffeinated', enabled: false },
  ];
  if (isTimed(state)) {
    const remainingMs = Math.max(0, state.expiresAt - nowMs);
    submenu.push({
      id: 'remaining',
      text: `${describeDuration(remainingMs)} left`,
      enabled: false,
    });
  }
  submenu.push({ id: 'decaffeinate', text: 'Decaffeinate' });

  return {
    id: TRAY_ITEM_ID,
    icon: '☕',
    text,
    submenu,
  };
}

function topLevelText(state: CoffeeState, nowMs: number): string {
  if (state.mode === 'timed') {
    const remainingMs = Math.max(0, state.expiresAt - nowMs);
    return `Caffeinated — ${describeDuration(remainingMs)} left`;
  }
  if (isWhileApp(state)) {
    return `Caffeinated while ${state.appName}`;
  }
  return 'Caffeinated';
}
