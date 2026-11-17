import { describe, expect, it } from 'vitest';
import type { InstalledApplication } from 'asyar-sdk/contracts';
import {
  applicationKey,
  clampIndex,
  filterApplications,
  initialFor,
  moveSelection,
  pickerIntent,
  subtitleFor,
} from './appPicker';

const app = (name: string, extra: Partial<InstalledApplication> = {}): InstalledApplication => ({
  id: name,
  name,
  path: `/Applications/${name}.app`,
  ...extra,
});

describe('filterApplications', () => {
  const apps = [
    app('Xcode', { bundleId: 'com.apple.dt.Xcode' }),
    app('Safari', { bundleId: 'com.apple.Safari' }),
    app('Visual Studio Code', { bundleId: 'com.microsoft.VSCode' }),
  ];

  it('returns every application for an empty or whitespace-only query', () => {
    expect(filterApplications(apps, '')).toEqual(apps);
    expect(filterApplications(apps, '   ')).toEqual(apps);
  });

  it('matches application names case-insensitively and trims the query', () => {
    expect(filterApplications(apps, '  xcode ').map((a) => a.name)).toEqual(['Xcode']);
    expect(filterApplications(apps, 'CODE').map((a) => a.name)).toEqual([
      'Xcode',
      'Visual Studio Code',
    ]);
  });

  it('matches the bundle identifier so a user can type com.apple.Safari', () => {
    expect(filterApplications(apps, 'com.apple.SAFARI').map((a) => a.name)).toEqual(['Safari']);
  });

  it('returns an empty list when nothing matches, without mutating the input', () => {
    const original = [...apps];
    expect(filterApplications(apps, 'not-installed')).toEqual([]);
    expect(apps).toEqual(original);
  });
});

describe('moveSelection', () => {
  it('moves one row at a time and wraps at both ends', () => {
    expect(moveSelection(3, 0, 'down')).toBe(1);
    expect(moveSelection(3, 2, 'down')).toBe(0);
    expect(moveSelection(3, 2, 'up')).toBe(1);
    expect(moveSelection(3, 0, 'up')).toBe(2);
  });

  it('returns -1 for an empty list and 0 for a single row', () => {
    expect(moveSelection(0, 0, 'down')).toBe(-1);
    expect(moveSelection(1, 0, 'up')).toBe(0);
    expect(moveSelection(1, 0, 'down')).toBe(0);
  });
});

describe('clampIndex', () => {
  it('keeps a valid index and clamps an invalid one after the list shrinks', () => {
    expect(clampIndex(5, 2)).toBe(2);
    expect(clampIndex(2, 7)).toBe(1);
    expect(clampIndex(5, -3)).toBe(0);
    expect(clampIndex(0, 4)).toBe(-1);
  });
});

describe('pickerIntent', () => {
  it('maps the host-forwarded navigation keys', () => {
    expect(pickerIntent({ key: 'ArrowUp' })).toBe('up');
    expect(pickerIntent({ key: 'ArrowDown' })).toBe('down');
    expect(pickerIntent({ key: 'Enter' })).toBe('select');
  });

  it('ignores unrelated keys and modified chords', () => {
    expect(pickerIntent({ key: 'Escape' })).toBeNull();
    expect(pickerIntent({ key: 'a' })).toBeNull();
    expect(pickerIntent({ key: 'Enter', metaKey: true })).toBeNull();
    expect(pickerIntent({ key: 'ArrowDown', ctrlKey: true })).toBeNull();
    expect(pickerIntent({ key: 'ArrowUp', altKey: true })).toBeNull();
    expect(pickerIntent({ key: 'ArrowUp', shiftKey: true })).toBeNull();
  });
});

describe('application metadata helpers', () => {
  it('prefers the native bundle id as the stable identity key', () => {
    expect(applicationKey(app('Xcode', { bundleId: 'com.apple.dt.Xcode' }))).toBe(
      'com.apple.dt.Xcode',
    );
    expect(applicationKey(app('Firefox', { bundleId: undefined }))).toBe('Firefox');
  });

  it('uses the bundle id, then the path, for the muted subtitle', () => {
    expect(subtitleFor(app('Xcode', { bundleId: 'com.apple.dt.Xcode' }))).toBe(
      'com.apple.dt.Xcode',
    );
    expect(subtitleFor(app('Firefox', { bundleId: undefined }))).toBe('/Applications/Firefox.app');
    expect(subtitleFor({ id: 'x', name: 'X', path: '' })).toBe('');
  });

  it('falls back to a capital initial when an icon cannot be rendered', () => {
    expect(initialFor('xcode')).toBe('X');
    expect(initialFor('  ')).toBe('?');
  });
});
