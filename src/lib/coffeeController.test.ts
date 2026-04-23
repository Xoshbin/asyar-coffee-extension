import { describe, it, expect, vi } from 'vitest';
import { CoffeeController, type CoffeeControllerDeps } from './coffeeController';
import { INITIAL_STATE } from './caffeineState';

function makeState(seed: Record<string, unknown> = {}) {
  const store = new Map<string, unknown>();
  for (const [k, v] of Object.entries(seed)) {
    store.set(k, v);
  }
  return {
    get: vi.fn(async (key: string) => (store.has(key) ? store.get(key) : null)),
    set: vi.fn(async (key: string, value: unknown) => { store.set(key, value); }),
    subscribe: vi.fn(async () => async () => {}),
  };
}

function makeStatusBar() {
  return {
    registerItem: vi.fn(),
    updateItem: vi.fn(),
    unregisterItem: vi.fn(),
  };
}

function makePower() {
  return {
    keepAwake: vi.fn(async () => 'token-1'),
    release: vi.fn(async () => undefined),
    list: vi.fn(async () => [] as Array<{ token: string; options: any; reason: string; createdAt: number }>),
  };
}

function makeTimers() {
  return {
    schedule: vi.fn(async () => 'timer-1'),
    cancel: vi.fn(async () => undefined),
    list: vi.fn(async () => [] as Array<{ timerId: string; extensionId: string; commandId: string; args: Record<string, unknown>; fireAt: number; createdAt: number }>),
  };
}

function makeApplication() {
  return {
    isRunning: vi.fn(async () => true),
    listApplications: vi.fn(async () => []),
    onApplicationTerminated: vi.fn(() => () => {}),
    getFrontmostApplication: vi.fn(),
    syncApplicationIndex: vi.fn(),
    onApplicationLaunched: vi.fn(() => () => {}),
    onFrontmostApplicationChanged: vi.fn(() => () => {}),
  };
}

function makeSystemEvents() {
  return {
    onSystemSleep: vi.fn(() => () => {}),
    onSystemWake: vi.fn(() => () => {}),
    onLidOpen: vi.fn(() => () => {}),
    onLidClose: vi.fn(() => () => {}),
    onBatteryLevelChange: vi.fn(() => () => {}),
    onPowerSourceChange: vi.fn(() => () => {}),
  };
}

function makePreferences(initial: Record<string, unknown> = {}) {
  return {
    values: Object.freeze({ ...initial }) as Readonly<Record<string, unknown>>,
  };
}

function makeNotifier() {
  return {
    checkPermission: vi.fn(async () => true),
    requestPermission: vi.fn(async () => true),
    send: vi.fn(async () => 'notif-1'),
    dismiss: vi.fn(async () => undefined),
  };
}

export function buildDeps(
  overrides: Partial<CoffeeControllerDeps> = {},
): CoffeeControllerDeps {
  return {
    state: makeState() as any,
    statusBar: makeStatusBar() as any,
    power: makePower() as any,
    timers: makeTimers() as any,
    application: makeApplication() as any,
    systemEvents: makeSystemEvents() as any,
    preferences: makePreferences({
      preventDisplay: true,
      preventSystem: true,
      preventDisk: true,
      hideTrayWhenIdle: false,
    }) as any,
    notifier: makeNotifier() as any,
    now: () => 1_000_000,
    ...overrides,
  };
}

function lastStoredState(state: { set: any }): unknown {
  const calls = state.set.mock.calls;
  const last = calls[calls.length - 1];
  return last ? (last[1] as unknown) : undefined;
}

describe('CoffeeController — activate', () => {
  it('loads INITIAL_STATE from empty state store and renders idle tray', async () => {
    const deps = buildDeps();
    const ctrl = new CoffeeController(deps);
    await ctrl.activate();

    expect(deps.state.get).toHaveBeenCalledWith('state');
    expect(ctrl.getState()).toEqual(INITIAL_STATE);
    expect(deps.statusBar.registerItem).toHaveBeenCalledTimes(1);
    const item = (deps.statusBar.registerItem as any).mock.calls[0][0];
    expect(item.text).toBe('Decaffeinated');
  });

  it('hides tray when idle + hideTrayWhenIdle=true', async () => {
    const deps = buildDeps({
      preferences: makePreferences({
        preventDisplay: true, preventSystem: true, preventDisk: true, hideTrayWhenIdle: true,
      }) as any,
    });
    const ctrl = new CoffeeController(deps);
    await ctrl.activate();
    expect(deps.statusBar.registerItem).not.toHaveBeenCalled();
    expect(deps.statusBar.unregisterItem).toHaveBeenCalledWith('coffee-tray');
  });

  it('subscribes onSystemWake exactly once', async () => {
    const deps = buildDeps();
    const ctrl = new CoffeeController(deps);
    await ctrl.activate();
    expect(deps.systemEvents.onSystemWake).toHaveBeenCalledTimes(1);
  });
});

describe('CoffeeController — caffeinate (indefinite)', () => {
  it('requests an inhibitor, persists state, and updates the tray', async () => {
    const deps = buildDeps();
    const ctrl = new CoffeeController(deps);
    await ctrl.activate();

    await ctrl.caffeinate();

    expect(deps.power.keepAwake).toHaveBeenCalledWith({
      system: true,
      display: true,
      disk: true,
      reason: expect.stringContaining('indefinite'),
    });
    expect(ctrl.getState()).toMatchObject({ mode: 'indefinite', token: 'token-1' });
    expect(lastStoredState(deps.state)).toMatchObject({ mode: 'indefinite', token: 'token-1' });
    expect(deps.statusBar.updateItem).toHaveBeenCalled();
  });

  it('releases a prior token before starting a new inhibitor', async () => {
    const seeded = makeState({
      state: { mode: 'indefinite', token: 'old-token', startedAt: 0 },
    });
    const power = makePower();
    power.keepAwake = vi.fn(async () => 'new-token');
    power.list = vi.fn(async () => [{ token: 'old-token', options: {}, reason: '', createdAt: 0 }]);
    const deps = buildDeps({ state: seeded as any, power: power as any });
    const ctrl = new CoffeeController(deps);
    await ctrl.activate();

    await ctrl.caffeinate();

    expect(deps.power.release).toHaveBeenCalledWith('old-token');
    expect(ctrl.getState()).toMatchObject({ mode: 'indefinite', token: 'new-token' });
  });

  it('honors preventDisplay / preventSystem / preventDisk prefs', async () => {
    const deps = buildDeps({
      preferences: makePreferences({
        preventDisplay: false,
        preventSystem: true,
        preventDisk: false,
        hideTrayWhenIdle: false,
      }) as any,
    });
    const ctrl = new CoffeeController(deps);
    await ctrl.activate();
    await ctrl.caffeinate();
    expect(deps.power.keepAwake).toHaveBeenCalledWith({
      system: true,
      display: false,
      disk: false,
      reason: expect.any(String),
    });
  });
});

describe('CoffeeController — decaffeinate', () => {
  it('is a no-op when already idle', async () => {
    const deps = buildDeps();
    const ctrl = new CoffeeController(deps);
    await ctrl.activate();
    await ctrl.decaffeinate();
    expect(deps.power.release).not.toHaveBeenCalled();
    expect(ctrl.getState()).toEqual(INITIAL_STATE);
  });

  it('releases token from indefinite mode', async () => {
    const deps = buildDeps();
    const ctrl = new CoffeeController(deps);
    await ctrl.activate();
    await ctrl.caffeinate();
    await ctrl.decaffeinate();
    expect(deps.power.release).toHaveBeenCalledWith('token-1');
    expect(ctrl.getState()).toEqual(INITIAL_STATE);
  });

  it('cancels the pending timer when leaving timed mode', async () => {
    const seeded = makeState({
      state: {
        mode: 'timed', token: 'tok', startedAt: 0,
        expiresAt: 9_999_999_999, timerId: 'timer-abc',
      },
    });
    const power = makePower();
    power.list = vi.fn(async () => [{ token: 'tok', options: {}, reason: '', createdAt: 0 }]);
    const timers = makeTimers();
    timers.list = vi.fn(async () => [
      { timerId: 'timer-abc', extensionId: 'org.asyar.coffee', commandId: 'decaffeinate', args: {}, fireAt: 9_999_999_999, createdAt: 0 },
    ]);
    const deps = buildDeps({ state: seeded as any, power: power as any, timers: timers as any });
    const ctrl = new CoffeeController(deps);
    await ctrl.activate();
    await ctrl.decaffeinate();
    expect(deps.timers.cancel).toHaveBeenCalledWith('timer-abc');
    expect(deps.power.release).toHaveBeenCalledWith('tok');
  });
});

describe('CoffeeController — caffeinateFor', () => {
  it('schedules a timer and enters timed mode', async () => {
    const deps = buildDeps({ now: () => 1_000_000 });
    const ctrl = new CoffeeController(deps);
    await ctrl.activate();

    await ctrl.caffeinateFor({ hours: 0, minutes: 30, seconds: 0 });

    expect(deps.power.keepAwake).toHaveBeenCalledWith(
      expect.objectContaining({ reason: expect.stringContaining('30m') }),
    );
    expect(deps.timers.schedule).toHaveBeenCalledWith({
      commandId: 'decaffeinate',
      fireAt: 1_000_000 + 30 * 60 * 1000,
      args: { reason: 'expired' },
    });
    expect(ctrl.getState()).toMatchObject({
      mode: 'timed', token: 'token-1', timerId: 'timer-1',
      expiresAt: 1_000_000 + 30 * 60 * 1000,
    });
  });

  it('rejects zero-total with a notification and leaves state unchanged', async () => {
    const deps = buildDeps();
    const ctrl = new CoffeeController(deps);
    await ctrl.activate();
    await ctrl.caffeinateFor({ hours: 0, minutes: 0, seconds: 0 });
    expect(deps.power.keepAwake).not.toHaveBeenCalled();
    expect(deps.notifier.send).toHaveBeenCalled();
    expect(ctrl.getState()).toEqual(INITIAL_STATE);
  });
});

describe('CoffeeController — caffeinateUntil', () => {
  it('converts HH:mm to fireAt and delegates to the timed path', async () => {
    const nowMs = new Date('2026-04-19T08:00:00').getTime();
    const deps = buildDeps({ now: () => nowMs });
    const ctrl = new CoffeeController(deps);
    await ctrl.activate();
    await ctrl.caffeinateUntil({ time: '09:30' });
    const expected = new Date('2026-04-19T09:30:00').getTime();
    expect(deps.timers.schedule).toHaveBeenCalledWith(
      expect.objectContaining({ commandId: 'decaffeinate', fireAt: expected }),
    );
  });

  it('rejects malformed HH:mm with a notification', async () => {
    const deps = buildDeps();
    const ctrl = new CoffeeController(deps);
    await ctrl.activate();
    await ctrl.caffeinateUntil({ time: '9am' });
    expect(deps.power.keepAwake).not.toHaveBeenCalled();
    expect(deps.notifier.send).toHaveBeenCalled();
  });
});

describe('CoffeeController — toggle', () => {
  it('caffeinates when idle', async () => {
    const deps = buildDeps();
    const ctrl = new CoffeeController(deps);
    await ctrl.activate();
    await ctrl.toggle();
    expect(ctrl.getState().mode).toBe('indefinite');
  });

  it('decaffeinates when active', async () => {
    const deps = buildDeps();
    const ctrl = new CoffeeController(deps);
    await ctrl.activate();
    await ctrl.caffeinate();
    await ctrl.toggle();
    expect(ctrl.getState().mode).toBe('idle');
  });
});

describe('CoffeeController — emitStatusNotification', () => {
  it('notifies decaffeinated state', async () => {
    const deps = buildDeps();
    const ctrl = new CoffeeController(deps);
    await ctrl.activate();
    await ctrl.emitStatusNotification();
    expect(deps.notifier.send).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringMatching(/decaffeinated/i) }),
    );
  });

  it('includes remaining time for timed mode', async () => {
    const deps = buildDeps({ now: () => 0 });
    const ctrl = new CoffeeController(deps);
    await ctrl.activate();
    await ctrl.caffeinateFor({ hours: 1, minutes: 0, seconds: 0 });
    (deps.notifier.send as any).mockClear();
    await ctrl.emitStatusNotification();
    expect(deps.notifier.send).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringContaining('1h') }),
    );
  });
});

describe('CoffeeController — caffeinateWhile', () => {
  it('rejects if app is not running', async () => {
    const application = makeApplication();
    application.isRunning = vi.fn(async () => false);
    const deps = buildDeps({ application: application as any });
    const ctrl = new CoffeeController(deps);
    await ctrl.activate();
    await ctrl.caffeinateWhile({ bundleId: 'com.apple.Safari', appName: 'Safari' });
    expect(deps.power.keepAwake).not.toHaveBeenCalled();
    expect(deps.notifier.send).toHaveBeenCalled();
    expect(ctrl.getState()).toEqual(INITIAL_STATE);
  });

  it('starts inhibitor and subscribes to onApplicationTerminated', async () => {
    const application = makeApplication();
    let termCb: ((e: any) => void) | null = null;
    application.onApplicationTerminated = vi.fn((cb: any) => {
      termCb = cb;
      return () => {};
    });
    const deps = buildDeps({ application: application as any });
    const ctrl = new CoffeeController(deps);
    await ctrl.activate();
    await ctrl.caffeinateWhile({ bundleId: 'com.apple.Safari', appName: 'Safari' });
    expect(ctrl.getState()).toMatchObject({
      mode: 'while-app',
      bundleId: 'com.apple.Safari',
      appName: 'Safari',
    });
    expect(application.onApplicationTerminated).toHaveBeenCalledTimes(1);
    expect(typeof termCb).toBe('function');
  });

  it('decaffeinates when target app terminates', async () => {
    const application = makeApplication();
    let termCb: ((e: any) => void) | null = null;
    application.onApplicationTerminated = vi.fn((cb: any) => {
      termCb = cb;
      return () => {};
    });
    const deps = buildDeps({ application: application as any });
    const ctrl = new CoffeeController(deps);
    await ctrl.activate();
    await ctrl.caffeinateWhile({ bundleId: 'com.apple.Safari', appName: 'Safari' });
    termCb!({ bundleId: 'com.apple.Safari', name: 'Safari', pid: 42 });
    await new Promise((r) => setTimeout(r, 0));
    expect(deps.power.release).toHaveBeenCalledWith('token-1');
    expect(ctrl.getState()).toEqual(INITIAL_STATE);
  });

  it('ignores termination events for other apps', async () => {
    const application = makeApplication();
    let termCb: ((e: any) => void) | null = null;
    application.onApplicationTerminated = vi.fn((cb: any) => {
      termCb = cb;
      return () => {};
    });
    const deps = buildDeps({ application: application as any });
    const ctrl = new CoffeeController(deps);
    await ctrl.activate();
    await ctrl.caffeinateWhile({ bundleId: 'com.apple.Safari', appName: 'Safari' });
    termCb!({ bundleId: 'com.apple.Terminal', name: 'Terminal', pid: 99 });
    await new Promise((r) => setTimeout(r, 0));
    expect(deps.power.release).not.toHaveBeenCalled();
    expect(ctrl.getState().mode).toBe('while-app');
  });
});

describe('CoffeeController — reconcile on activate', () => {
  it('resets to idle when persisted token is no longer alive', async () => {
    const deps = buildDeps({
      state: makeState({
        state: { mode: 'indefinite', token: 'stale', startedAt: 0 },
      }) as any,
    });
    const ctrl = new CoffeeController(deps);
    await ctrl.activate();
    expect(ctrl.getState()).toEqual(INITIAL_STATE);
    expect(deps.state.set).toHaveBeenCalledWith('state', INITIAL_STATE);
  });

  it('keeps indefinite state when token is alive', async () => {
    const power = makePower();
    power.list = vi.fn(async () => [{ token: 'live-tok', options: {}, reason: '', createdAt: 0 }]);
    const deps = buildDeps({
      state: makeState({
        state: { mode: 'indefinite', token: 'live-tok', startedAt: 0 },
      }) as any,
      power: power as any,
    });
    const ctrl = new CoffeeController(deps);
    await ctrl.activate();
    expect(ctrl.getState()).toMatchObject({ mode: 'indefinite', token: 'live-tok' });
  });

  it('decaffeinates when timer already fired (missing from timers.list)', async () => {
    const power = makePower();
    power.list = vi.fn(async () => [{ token: 'live-tok', options: {}, reason: '', createdAt: 0 }]);
    const timers = makeTimers();
    timers.list = vi.fn(async () => []);
    const deps = buildDeps({
      state: makeState({
        state: {
          mode: 'timed', token: 'live-tok', startedAt: 0, expiresAt: 10, timerId: 'gone',
        },
      }) as any,
      power: power as any,
      timers: timers as any,
    });
    const ctrl = new CoffeeController(deps);
    await ctrl.activate();
    expect(deps.power.release).toHaveBeenCalledWith('live-tok');
    expect(ctrl.getState()).toEqual(INITIAL_STATE);
  });

  it('decaffeinates while-app when target app is no longer running', async () => {
    const application = makeApplication();
    application.isRunning = vi.fn(async () => false);
    const power = makePower();
    power.list = vi.fn(async () => [{ token: 'live-tok', options: {}, reason: '', createdAt: 0 }]);
    const deps = buildDeps({
      state: makeState({
        state: {
          mode: 'while-app', token: 'live-tok', startedAt: 0,
          bundleId: 'com.apple.Safari', appName: 'Safari',
        },
      }) as any,
      power: power as any,
      application: application as any,
    });
    const ctrl = new CoffeeController(deps);
    await ctrl.activate();
    expect(deps.power.release).toHaveBeenCalledWith('live-tok');
    expect(ctrl.getState()).toEqual(INITIAL_STATE);
  });

  it('rewires the app watcher for a still-running while-app state', async () => {
    const application = makeApplication();
    application.isRunning = vi.fn(async () => true);
    const onTerm = vi.fn(() => () => {});
    application.onApplicationTerminated = onTerm;
    const power = makePower();
    power.list = vi.fn(async () => [{ token: 'live-tok', options: {}, reason: '', createdAt: 0 }]);
    const deps = buildDeps({
      state: makeState({
        state: {
          mode: 'while-app', token: 'live-tok', startedAt: 0,
          bundleId: 'com.apple.Safari', appName: 'Safari',
        },
      }) as any,
      power: power as any,
      application: application as any,
    });
    const ctrl = new CoffeeController(deps);
    await ctrl.activate();
    expect(onTerm).toHaveBeenCalledTimes(1);
    expect(ctrl.getState().mode).toBe('while-app');
  });
});
