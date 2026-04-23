import type {
  IStatusBarService,
  IPowerService,
  ITimerService,
  IApplicationService,
  ISystemEventsService,
  INotificationService,
} from 'asyar-sdk/contracts';
import {
  INITIAL_STATE,
  describeDuration,
  type CoffeeState,
} from './caffeineState';
import { renderTrayMenu, TRAY_ITEM_ID, type TrayPrefs } from './trayMenu';
import { toMillis, DurationError, type DurationInput } from './durationArgs';
import { parseHhmmToFireAt, UntilError } from './untilArgs';

const STATE_KEY = 'state';

/**
 * Synchronous view over the extension's preferences snapshot.
 * Matches the `.values` shape on `context.preferences` (a frozen object
 * exposed by `PreferencesFacade`). Injecting just the shape we need keeps
 * the controller decoupled from the facade class and trivially fakeable
 * in unit tests.
 */
export interface PreferencesView {
  readonly values: Readonly<Record<string, unknown>>;
}

/**
 * Narrow view over the launcher-brokered extension state store. The
 * controller only needs `get`/`set`; `subscribe` is exposed on the real
 * proxy but unused here because this extension keeps state single-writer
 * (worker owns, view never mutates).
 */
export interface StateStoreView {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

export interface CoffeeControllerDeps {
  state: StateStoreView;
  statusBar: IStatusBarService;
  power: IPowerService;
  timers: ITimerService;
  application: IApplicationService;
  systemEvents: ISystemEventsService;
  preferences: PreferencesView;
  notifier: INotificationService;
  now: () => number;
}

export class CoffeeController {
  private state: CoffeeState = INITIAL_STATE;
  private wakeDisposer?: () => void;
  private trayRegistered = false;
  private appWatcherDisposer?: () => void;

  constructor(private deps: CoffeeControllerDeps) {}

  getState(): CoffeeState {
    return this.state;
  }

  async activate(): Promise<void> {
    const raw = await this.deps.state.get(STATE_KEY);
    const persisted: CoffeeState =
      raw && typeof raw === 'object' ? (raw as CoffeeState) : INITIAL_STATE;
    await this.reconcile(persisted);
    this.wakeDisposer = this.deps.systemEvents.onSystemWake(() => this.refreshTray());
  }

  private async reconcile(persisted: CoffeeState): Promise<void> {
    if (persisted.mode === 'idle') {
      this.state = INITIAL_STATE;
      this.refreshTray();
      return;
    }

    // 1. Token liveness
    const liveTokens = new Set(
      (await this.deps.power.list()).map((i) => i.token),
    );
    if (!liveTokens.has(persisted.token)) {
      await this.setState(INITIAL_STATE);
      return;
    }

    // 2. Mode-specific checks
    if (persisted.mode === 'timed') {
      const timers = await this.deps.timers.list();
      const live = timers.find((t) => t.timerId === persisted.timerId);
      if (!live) {
        this.state = persisted;
        await this.decaffeinate();
        return;
      }
      this.state = persisted;
      this.refreshTray();
      return;
    }

    if (persisted.mode === 'while-app') {
      const stillRunning = await this.deps.application.isRunning(persisted.bundleId);
      if (!stillRunning) {
        this.state = persisted;
        await this.decaffeinate();
        return;
      }
      this.rewireAppWatcher(persisted.bundleId);
      this.state = persisted;
      this.refreshTray();
      return;
    }

    this.state = persisted;
    this.refreshTray();
  }

  async deactivate(): Promise<void> {
    this.wakeDisposer?.();
    this.wakeDisposer = undefined;
    this.appWatcherDisposer?.();
    this.appWatcherDisposer = undefined;
  }

  refreshTray(): void {
    const prefs = this.readTrayPrefs();
    const item = renderTrayMenu(this.state, prefs, this.deps.now());
    if (!item) {
      this.deps.statusBar.unregisterItem(TRAY_ITEM_ID);
      this.trayRegistered = false;
      return;
    }
    if (this.trayRegistered) {
      this.deps.statusBar.updateItem(TRAY_ITEM_ID, item);
    } else {
      this.deps.statusBar.registerItem(item);
      this.trayRegistered = true;
    }
  }

  async caffeinate(): Promise<void> {
    await this.releaseCurrentTokenIfAny();

    const prefs = this.readKeepAwakePrefs();
    const token = await this.deps.power.keepAwake({
      ...prefs,
      reason: 'Asyar Coffee — indefinite',
    });

    await this.setState({
      mode: 'indefinite',
      token,
      startedAt: this.deps.now(),
    });
  }

  async decaffeinate(): Promise<void> {
    if (this.state.mode === 'idle') return;

    if (this.state.mode === 'timed') {
      try {
        await this.deps.timers.cancel(this.state.timerId);
      } catch {
        // Timer may have already fired or been cleaned up.
      }
    }
    if (this.state.mode === 'while-app') {
      this.appWatcherDisposer?.();
      this.appWatcherDisposer = undefined;
    }

    await this.deps.power.release(this.state.token);
    await this.setState(INITIAL_STATE);
  }

  private async releaseCurrentTokenIfAny(): Promise<void> {
    if (this.state.mode === 'idle') return;
    try {
      await this.deps.power.release(this.state.token);
    } catch {
      // Token may already be gone — safe to continue.
    }
  }

  private readKeepAwakePrefs(): { system: boolean; display: boolean; disk: boolean } {
    const v = this.deps.preferences.values;
    return {
      system: Boolean(v.preventSystem),
      display: Boolean(v.preventDisplay),
      disk: Boolean(v.preventDisk),
    };
  }

  private async setState(next: CoffeeState): Promise<void> {
    this.state = next;
    await this.deps.state.set(STATE_KEY, next);
    this.refreshTray();
  }

  private readTrayPrefs(): TrayPrefs {
    return {
      hideTrayWhenIdle: Boolean(this.deps.preferences.values.hideTrayWhenIdle),
    };
  }

  async caffeinateFor(input: DurationInput): Promise<void> {
    let totalMs: number;
    try {
      totalMs = toMillis(input);
    } catch (err) {
      if (err instanceof DurationError) {
        await this.notifyError('Coffee', err.message);
        return;
      }
      throw err;
    }
    await this.startTimed(this.deps.now() + totalMs, totalMs);
  }

  async caffeinateUntil(input: { time: string }): Promise<void> {
    let fireAt: number;
    try {
      fireAt = parseHhmmToFireAt(this.deps.now(), input.time);
    } catch (err) {
      if (err instanceof UntilError) {
        await this.notifyError('Coffee', err.message);
        return;
      }
      throw err;
    }
    await this.startTimed(fireAt, fireAt - this.deps.now());
  }

  private async startTimed(fireAt: number, durationMs: number): Promise<void> {
    await this.releaseCurrentTokenIfAny();

    const prefs = this.readKeepAwakePrefs();
    const token = await this.deps.power.keepAwake({
      ...prefs,
      reason: `Asyar Coffee — ${describeDuration(durationMs)}`,
    });

    const timerId = await this.deps.timers.schedule({
      commandId: 'decaffeinate',
      fireAt,
      args: { reason: 'expired' },
    });

    await this.setState({
      mode: 'timed',
      token,
      startedAt: this.deps.now(),
      expiresAt: fireAt,
      timerId,
    });
  }

  async toggle(): Promise<void> {
    if (this.state.mode === 'idle') {
      await this.caffeinate();
    } else {
      await this.decaffeinate();
    }
  }

  async emitStatusNotification(): Promise<void> {
    const body = this.describeCurrentStatus();
    await this.deps.notifier.send({ title: 'Coffee', body });
  }

  private describeCurrentStatus(): string {
    switch (this.state.mode) {
      case 'idle':
        return 'Decaffeinated.';
      case 'indefinite':
        return 'Caffeinated indefinitely.';
      case 'timed': {
        const remainingMs = Math.max(0, this.state.expiresAt - this.deps.now());
        return `Caffeinated — ${describeDuration(remainingMs)} remaining.`;
      }
      case 'while-app':
        return `Caffeinated while ${this.state.appName} is running.`;
    }
  }

  private async notifyError(title: string, message: string): Promise<void> {
    try {
      await this.deps.notifier.send({ title, body: message });
    } catch {
      // Notification pipeline down — safe to swallow.
    }
  }

  async caffeinateWhile(input: {
    bundleId: string;
    appName: string;
  }): Promise<void> {
    const running = await this.deps.application.isRunning(input.bundleId);
    if (!running) {
      await this.notifyError('Coffee', `${input.appName} is not running.`);
      return;
    }

    await this.releaseCurrentTokenIfAny();

    const prefs = this.readKeepAwakePrefs();
    const token = await this.deps.power.keepAwake({
      ...prefs,
      reason: `Asyar Coffee — while ${input.appName}`,
    });

    this.rewireAppWatcher(input.bundleId);

    await this.setState({
      mode: 'while-app',
      token,
      startedAt: this.deps.now(),
      bundleId: input.bundleId,
      appName: input.appName,
    });
  }

  private rewireAppWatcher(bundleId: string): void {
    this.appWatcherDisposer?.();
    this.appWatcherDisposer = this.deps.application.onApplicationTerminated(
      (evt) => {
        if (evt.bundleId !== bundleId) return;
        void this.decaffeinate();
      },
    );
  }
}
