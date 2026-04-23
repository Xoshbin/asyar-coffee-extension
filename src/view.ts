// ───────────────────────────────────────────────────────────────────────────
// view.ts — Tier 2 Coffee extension view entry, loaded by dist/view.html.
//
// Responsibilities are strictly display-side:
//   1) Register the CoffeeViewExtension with the bridge so the single
//      `mode: "view"` command (`caffeinate-while`) navigates to the picker.
//   2) Bootstrap ExtensionContext, post asyar:extension:loaded, forward ⌘K.
//   3) Mount CaffeinateWhileView.svelte when `?view=CaffeinateWhileView`.
//
// Every cross-boundary side-effect (tokens, persistence, subscriptions)
// happens on the worker side. The picker view calls `context.request(...)`
// to hand control off to the worker when the user selects an app.
//
// Imports come exclusively from `asyar-sdk/view`, which asserts
// `window.__ASYAR_ROLE__ === "view"` at module-load time.
// ───────────────────────────────────────────────────────────────────────────

import 'asyar-sdk/tokens.css';
import { mount } from 'svelte';
import {
  ExtensionContext,
  extensionBridge,
  registerIconElement,
  type Extension,
  type IExtensionManager,
} from 'asyar-sdk/view';
import manifest from '../manifest.json';
import CaffeinateWhileView from './views/CaffeinateWhileView.svelte';

class CoffeeViewExtension implements Extension {
  private extensionManager?: IExtensionManager;

  async initialize(ctx: ExtensionContext): Promise<void> {
    this.extensionManager = ctx.getService<IExtensionManager>('extensions');
  }

  async activate(): Promise<void> {}
  async deactivate(): Promise<void> {}

  async executeCommand(commandId: string): Promise<unknown> {
    if (commandId === 'caffeinate-while') {
      this.extensionManager?.navigateToView(
        'org.asyar.coffee/CaffeinateWhileView',
      );
      return { type: 'view', viewPath: 'org.asyar.coffee/CaffeinateWhileView' };
    }
    return undefined;
  }

  onUnload = (): void => {};
}

const extensionId =
  window.location.hostname === 'localhost' ||
  window.location.hostname === 'asyar-extension.localhost'
    ? window.location.pathname.split('/').filter(Boolean)[0] || 'org.asyar.coffee'
    : window.location.hostname || 'org.asyar.coffee';

const context = new ExtensionContext();
context.setExtensionId(extensionId);
registerIconElement();

const viewExtension = new CoffeeViewExtension();
extensionBridge.registerManifest(manifest as Parameters<typeof extensionBridge.registerManifest>[0]);
extensionBridge.registerExtensionImplementation(extensionId, viewExtension);

window.addEventListener('keydown', (event) => {
  const isCommandK = (event.metaKey || event.ctrlKey) && event.key === 'k';
  if (isCommandK) {
    event.preventDefault();
    window.parent.postMessage(
      {
        type: 'asyar:extension:keydown',
        payload: {
          key: event.key,
          metaKey: event.metaKey,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
        },
      },
      '*',
    );
  }
});

void (async () => {
  await viewExtension.initialize(context);
  await viewExtension.activate();
})();

const viewName = new URLSearchParams(window.location.search).get('view');
const target = document.getElementById('app');
if (viewName === 'CaffeinateWhileView' && target) {
  mount(CaffeinateWhileView, {
    target,
    props: { context },
  });
}
