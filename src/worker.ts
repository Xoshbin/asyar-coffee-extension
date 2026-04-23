// ───────────────────────────────────────────────────────────────────────────
// worker.ts — Tier 2 Coffee extension worker entry, loaded by dist/worker.html.
//
// Owns every long-lived concern: the CoffeeController (keep-awake token,
// tray item, persisted state), the systemEvents.onSystemWake subscription,
// the per-"while-app" onApplicationTerminated subscription, the scheduled
// `index` tick that re-renders the tray label, and the view → worker RPC
// handler for `caffeinateWhile`.
//
// Imports come from `asyar-sdk/worker` (role assertion + worker-only
// ExtensionContext class with `onRequest`) and `asyar-sdk/contracts`
// (pure types — service interfaces + the Extension interface). The /worker
// entry asserts `window.__ASYAR_ROLE__ === "worker"` at module load time;
// the Rust `asyar-extension://` scheme handler injects that global into
// `worker.html` at serve time (see `uri_schemes.rs`).
// ───────────────────────────────────────────────────────────────────────────

import {
  ExtensionContext as WorkerExtensionContext,
  extensionBridge,
} from 'asyar-sdk/worker';
import type {
  Extension,
  ExtensionContext,
  CommandExecuteArgs,
  ILogService,
  INotificationService,
  IApplicationService,
  IPowerService,
  ISystemEventsService,
  ITimerService,
  IStatusBarService,
  ExtensionStateProxy,
} from 'asyar-sdk/contracts';
import manifest from '../manifest.json';
import { CoffeeController } from './lib/coffeeController';

const extensionId =
  window.location.hostname === 'localhost' ||
  window.location.hostname === 'asyar-extension.localhost'
    ? window.location.pathname.split('/').filter(Boolean)[0] || 'org.asyar.coffee'
    : window.location.hostname || 'org.asyar.coffee';

const workerContext = new WorkerExtensionContext();
workerContext.setExtensionId(extensionId);

const log = workerContext.getService<ILogService>('log');

const controller = new CoffeeController({
  state: workerContext.getService<ExtensionStateProxy>('state'),
  statusBar: workerContext.getService<IStatusBarService>('statusBar'),
  power: workerContext.getService<IPowerService>('power'),
  timers: workerContext.getService<ITimerService>('timers'),
  application: workerContext.getService<IApplicationService>('application'),
  systemEvents: workerContext.getService<ISystemEventsService>('systemEvents'),
  preferences: workerContext.preferences,
  notifier: workerContext.getService<INotificationService>('notifications'),
  now: () => Date.now(),
});

// The Extension interface's `initialize(ctx)` expects the contracts-flavored
// ExtensionContext, which is a sibling (not a supertype) of the worker-
// flavored class we construct at module scope. Since this worker owns its
// own context lexically, the `initialize` hook is a no-op — the controller
// is already wired via `workerContext` above.
class CoffeeWorkerExtension implements Extension {
  async initialize(_ctx: ExtensionContext): Promise<void> {}

  async activate(): Promise<void> {
    await controller.activate();
  }

  async deactivate(): Promise<void> {
    await controller.deactivate();
  }

  async executeCommand(
    commandId: string,
    args?: CommandExecuteArgs,
  ): Promise<unknown> {
    const userArgs = (args?.arguments ?? {}) as Record<string, unknown>;

    switch (commandId) {
      case 'caffeinate':
        return controller.caffeinate();

      case 'decaffeinate':
        return controller.decaffeinate();

      case 'caffeinate-toggle':
        return controller.toggle();

      case 'caffeinate-for':
        return controller.caffeinateFor({
          hours: Number(userArgs.hours ?? 0),
          minutes: Number(userArgs.minutes ?? 0),
          seconds: Number(userArgs.seconds ?? 0),
        });

      case 'caffeinate-until':
        return controller.caffeinateUntil({
          time: String(userArgs.time ?? ''),
        });

      case 'status':
        return controller.emitStatusNotification();

      case 'index':
        controller.refreshTray();
        return;

      default:
        return undefined;
    }
  }

  onUnload = (): void => {};
}

const coffeeExtension = new CoffeeWorkerExtension();

extensionBridge.registerManifest(manifest as Parameters<typeof extensionBridge.registerManifest>[0]);
extensionBridge.registerExtensionImplementation(extensionId, coffeeExtension);

workerContext.onRequest<{ bundleId: string; appName: string }, void>(
  'caffeinateWhile',
  async ({ bundleId, appName }) => {
    await controller.caffeinateWhile({ bundleId, appName });
  },
);

void (async () => {
  try {
    await coffeeExtension.activate();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error(`[${extensionId}] worker activate failed: ${msg}`);
  }
})();

window.addEventListener('beforeunload', () => {
  void coffeeExtension.deactivate();
});

// Export the controller for unit-test access in any future worker-level
// suite. Not imported by production code.
export { controller as coffeeController };
