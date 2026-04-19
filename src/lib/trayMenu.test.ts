import { describe, it, expect } from 'vitest';
import {
  renderTrayMenu,
  TRAY_ITEM_ID,
  type TrayPrefs,
} from './trayMenu';
import type { CoffeeState } from './caffeineState';

const DEFAULT_PREFS: TrayPrefs = { hideTrayWhenIdle: false };

describe('trayMenu.renderTrayMenu', () => {
  it('returns null when idle and hideTrayWhenIdle=true', () => {
    expect(renderTrayMenu({ mode: 'idle' }, { hideTrayWhenIdle: true }, 0)).toBeNull();
  });

  it('returns a visible top-level item when idle and hideTrayWhenIdle=false', () => {
    const item = renderTrayMenu({ mode: 'idle' }, DEFAULT_PREFS, 0);
    expect(item).not.toBeNull();
    expect(item!.id).toBe(TRAY_ITEM_ID);
    expect(item!.icon).toBe('💤');
    expect(item!.text).toBe('Decaffeinated');
  });

  it('idle submenu: header disabled + "Caffeinate"', () => {
    const item = renderTrayMenu({ mode: 'idle' }, DEFAULT_PREFS, 0);
    expect(item!.submenu).toHaveLength(2);
    expect(item!.submenu![0]).toMatchObject({
      text: 'Your mac is decaffeinated',
      enabled: false,
    });
    expect(item!.submenu![1]).toMatchObject({
      id: 'caffeinate',
      text: 'Caffeinate',
    });
  });

  it('indefinite mode — "Caffeinated" top-level, no time line', () => {
    const state: CoffeeState = { mode: 'indefinite', token: 't', startedAt: 0 };
    const item = renderTrayMenu(state, DEFAULT_PREFS, 0)!;
    expect(item.icon).toBe('☕');
    expect(item.text).toBe('Caffeinated');
    expect(item.submenu).toHaveLength(2);
    const ids = item.submenu!.map((e) => e.id);
    expect(ids).toContain('decaffeinate');
  });

  it('timed mode includes remaining-time line', () => {
    const state: CoffeeState = {
      mode: 'timed', token: 't', startedAt: 0, expiresAt: 3_600_000, timerId: 'x',
    };
    const item = renderTrayMenu(state, DEFAULT_PREFS, 0)!;
    expect(item.text).toContain('1h');
    expect(item.submenu).toHaveLength(3);
    expect(item.submenu![1]).toMatchObject({ enabled: false });
    expect(item.submenu![1].text).toContain('left');
  });

  it('while-app mode includes the app name', () => {
    const state: CoffeeState = {
      mode: 'while-app', token: 't', startedAt: 0,
      bundleId: 'com.apple.Safari', appName: 'Safari',
    };
    const item = renderTrayMenu(state, DEFAULT_PREFS, 0)!;
    expect(item.text).toContain('Safari');
    expect(item.submenu).toHaveLength(2);
  });

  it('hideTrayWhenIdle does not hide an active tray', () => {
    const state: CoffeeState = { mode: 'indefinite', token: 't', startedAt: 0 };
    const item = renderTrayMenu(state, { hideTrayWhenIdle: true }, 0);
    expect(item).not.toBeNull();
  });
});
