// Coffee extension bootstrap:
//   1. Parse extensionId from asyar-extension:// URL
//   2. Initialize SDK context
//   3. Register with ExtensionBridge so asyar:command:execute → executeCommand
//   4. Run initialize() + activate()
//   5. Post asyar:extension:loaded to host
//   6. Forward ⌘K to host
//   7. Mount CaffeinateWhileView when ?view=CaffeinateWhileView

import 'asyar-sdk/tokens.css';
import { mount } from 'svelte';
import {
  ExtensionContext,
  extensionBridge,
  registerIconElement,
} from 'asyar-sdk';
import coffeeExtension from './index';
import manifest from '../manifest.json';
import CaffeinateWhileView from './views/CaffeinateWhileView.svelte';

const extensionId = (
  window.location.hostname === 'localhost' ||
  window.location.hostname === 'asyar-extension.localhost'
)
  ? window.location.pathname.split('/').filter(Boolean)[0] || 'org.asyar.coffee'
  : window.location.hostname || 'org.asyar.coffee';
console.log(`[${extensionId}] Bootstrapping...`);

const context = new ExtensionContext();
context.setExtensionId(extensionId);
registerIconElement();

extensionBridge.registerManifest(manifest as any);
extensionBridge.registerExtensionImplementation(extensionId, coffeeExtension);

(async () => {
  await coffeeExtension.initialize(context);
  await coffeeExtension.activate();

  window.parent.postMessage({ type: 'asyar:extension:loaded', extensionId }, '*');

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

  const viewName = new URLSearchParams(window.location.search).get('view');
  const target = document.getElementById('app')!;
  if (viewName === 'CaffeinateWhileView') {
    mount(CaffeinateWhileView, {
      target,
      props: { context, coffeeExtension },
    });
  }

  window.addEventListener('beforeunload', () => {
    void coffeeExtension.deactivate();
  });
})().catch((err) => {
  console.error(`[${extensionId}] Bootstrap failed:`, err);
});
