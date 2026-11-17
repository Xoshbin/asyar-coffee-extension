<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type {
    ExtensionContext,
    IApplicationService,
    IFeedbackService,
    InstalledApplication,
  } from 'asyar-sdk/view';
  import {
    applicationKey,
    clampIndex,
    filterApplications,
    initialFor,
    moveSelection,
    pickerIntent,
    subtitleFor,
    type PickerIntent,
  } from '../lib/appPicker';

  let { context } = $props<{ context: ExtensionContext }>();

  const applicationService = $derived(context.getService<IApplicationService>('application'));
  const feedback = $derived(context.getService<IFeedbackService>('feedback'));

  // The launcher's 384px content area shows nine 38px rows plus a peek of the
  // tenth. Checking a dozen keeps the running badges accurate without firing
  // one IPC per installed application.
  const RUNNING_SCAN_ROWS = 12;

  let apps = $state<InstalledApplication[]>([]);
  let query = $state('');
  let selection = $state(0);
  let loading = $state(true);
  let loadError = $state<string | null>(null);
  let submitting = $state(false);
  let listEl = $state<HTMLUListElement | null>(null);

  let failedIcons = $state<Set<string>>(new Set());
  let runningRevision = $state(0);
  const iconFailures = new Set<string>();
  const runningStatus = new Map<string, boolean>();
  let scanToken = 0;

  const filtered = $derived(filterApplications(apps, query));
  const selectedApp = $derived(filtered[selection] ?? null);
  const emptyMessage = $derived(
    query.trim() ? `No applications match "${query.trim()}"` : 'No applications found',
  );
  const runningKeys = $derived.by(() => {
    void runningRevision; // revision is the invalidation signal for the plain cache
    return new Set([...runningStatus].filter(([, value]) => value).map(([key]) => key));
  });

  $effect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await applicationService.listApplications();
        if (alive) apps = list;
      } catch (err) {
        if (alive) loadError = err instanceof Error ? err.message : String(err);
      } finally {
        if (alive) loading = false;
      }
    })();
    return () => {
      alive = false;
    };
  });

  // Filtering resets the highlight; keep it on a real row as the list shrinks.
  $effect(() => {
    selection = clampIndex(filtered.length, selection);
  });

  $effect(() => {
    if (!selectedApp) return;
    const index = selection;
    requestAnimationFrame(() => {
      listEl
        ?.querySelector<HTMLElement>(`[data-row-index="${index}"]`)
        ?.scrollIntoView({ block: 'nearest' });
    });
  });

  // Bounded running-status lookup: visible rows plus the highlighted row.
  // Results are cached per identity so arrowing through the list adds no IPC.
  $effect(() => {
    if (loading || filtered.length === 0) return;
    const candidates = filtered.slice(0, RUNNING_SCAN_ROWS);
    if (selectedApp && !candidates.includes(selectedApp)) candidates.push(selectedApp);
    const targets = candidates.filter((app) => !runningStatus.has(applicationKey(app)));
    if (targets.length === 0) return;

    const token = ++scanToken;
    void Promise.all(
      targets.map(async (app) => {
        const key = applicationKey(app);
        try {
          const isRunning = await applicationService.isRunning(key);
          runningStatus.set(key, isRunning);
          if (token === scanToken && isRunning) runningRevision += 1;
        } catch {
          runningStatus.set(key, false);
        }
      }),
    );
  });

  function scrollSelectedIntoView() {
    const index = selection;
    requestAnimationFrame(() => {
      listEl
        ?.querySelector<HTMLElement>(`[data-row-index="${index}"]`)
        ?.scrollIntoView({ block: 'nearest' });
    });
  }

  function markIconFailed(key: string) {
    if (iconFailures.has(key)) return;
    iconFailures.add(key);
    failedIcons = new Set(iconFailures);
  }

  async function pick(app: InstalledApplication) {
    if (submitting) return;
    submitting = true;
    try {
      await context.request('caffeinateWhile', {
        bundleId: applicationKey(app),
        appName: app.name,
      });
      try {
        await feedback.showHUD(`Coffee active while ${app.name} runs`);
      } catch {
        // The HUD is a transient confirmation; never hold the dismissal on it.
      }
      context.hideLauncher();
    } catch (err) {
      loadError = err instanceof Error ? err.message : String(err);
      submitting = false;
    }
  }

  function dispatchIntent(intent: PickerIntent | null): boolean {
    if (intent === 'up' || intent === 'down') {
      selection = moveSelection(filtered.length, selection, intent);
      scrollSelectedIntoView();
      return true;
    }
    if (intent === 'select' && selectedApp) {
      void pick(selectedApp);
      return true;
    }
    return false;
  }

  function onHostMessage(event: MessageEvent) {
    if (event.source !== window.parent) return;
    const data: unknown = event.data;
    if (!data || typeof data !== 'object') return;
    const message = data as { type?: string; payload?: Record<string, unknown> };

    if (message.type === 'asyar:view:search') {
      // The host search bar is this view's only text field (manifest is
      // searchable); typing there lands here as asyar:view:search.
      query = typeof message.payload?.query === 'string' ? message.payload.query : '';
      selection = 0;
      return;
    }
    if (message.type !== 'asyar:view:keydown') return;
    const payload = message.payload ?? {};
    dispatchIntent(
      pickerIntent({
        key: typeof payload.key === 'string' ? payload.key : '',
        metaKey: payload.metaKey === true,
        ctrlKey: payload.ctrlKey === true,
        altKey: payload.altKey === true,
        shiftKey: payload.shiftKey === true,
      }),
    );
  }

  function onLocalKeydown(event: KeyboardEvent) {
    // Arrow/Enter come from the host while its search bar owns focus; this
    // path covers the case where the user has clicked into the view iframe.
    const handled = dispatchIntent(
      pickerIntent({
        key: event.key,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
      }),
    );
    if (handled) event.preventDefault();
  }

  onMount(() => {
    window.addEventListener('message', onHostMessage);
    window.addEventListener('keydown', onLocalKeydown);
  });

  onDestroy(() => {
    window.removeEventListener('message', onHostMessage);
    window.removeEventListener('keydown', onLocalKeydown);
  });
</script>

<div class="picker">
  <div class="picker-header">
    <span class="status-chip">Prevent sleep while selected application runs</span>
  </div>

  {#if loadError}
    <p class="picker-error" role="alert">{loadError}</p>
  {:else if loading}
    <p class="picker-placeholder">Scanning applications…</p>
  {:else if filtered.length === 0}
    <p class="picker-placeholder">{emptyMessage}</p>
  {:else}
    <ul class="app-list custom-scrollbar" aria-label="Applications" bind:this={listEl}>
      {#each filtered as app, index (app.path || app.id || applicationKey(app))}
        {@const key = applicationKey(app)}
        {@const subtitle = subtitleFor(app)}
        <li class="app-row-shell" data-row-index={index}>
          <button
            class="app-row"
            class:selected={selection === index}
            aria-current={selection === index ? 'true' : undefined}
            title={app.name}
            disabled={submitting}
            onclick={() => pick(app)}
            onmouseenter={() => (selection = index)}
          >
            <span class="app-icon" aria-hidden="true">
              {#if app.icon && !failedIcons.has(key)}
                <img src={app.icon} alt="" onerror={() => markIconFailed(key)} />
              {:else}
                <span class="app-initial">{initialFor(app.name)}</span>
              {/if}
            </span>

            <span class="app-copy">
              <span class="app-name">{app.name}</span>
              {#if subtitle}
                <span class="app-subtitle">{subtitle}</span>
              {/if}
            </span>

            {#if runningKeys.has(key)}
              <span class="running-badge">Running</span>
            {/if}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .picker {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    color: var(--text-primary);
    font-family: var(--font-ui);
    font-size: var(--font-size-base);
  }

  .picker-header {
    padding: var(--space-2) var(--space-3);
  }

  .status-chip {
    display: inline-block;
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--text-tertiary) 8%, transparent);
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    font-weight: 500;
  }

  .app-list {
    flex: 1;
    min-height: 0;
    margin: 0;
    padding: var(--space-1) var(--space-2);
    overflow-y: auto;
    list-style: none;
  }

  .app-row-shell {
    margin: 0;
  }

  /* Launcher row rhythm: exact 38px bands, touch-free, no divider. */
  .app-row {
    display: grid;
    grid-template-columns: 22px minmax(0, 1fr) auto;
    column-gap: var(--space-3);
    align-items: center;
    width: 100%;
    height: var(--shell-row-h);
    margin: 0;
    padding: 0 var(--space-3);
    border: none;
    border-radius: var(--radius-md);
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: default;
    /* Selection snaps under held arrow keys; a transition would smear it. */
    transition: none;
  }

  .app-row:focus,
  .app-row:focus-visible {
    outline: none;
  }

  .app-row:not(.selected):hover:not(:disabled) {
    background: var(--bg-hover);
  }

  /* The selected band is flat: --bg-selected is the only surface with chroma,
     and it snaps in with no transition. --kbd-rim is host-only, so it is not
     available to an iframe view. */
  .app-row.selected {
    background: var(--bg-selected);
  }

  .app-row.selected:focus-visible {
    box-shadow: var(--shadow-focus);
  }

  .app-row:disabled {
    opacity: 0.5;
  }

  /* The 22px launcher row icon column, not the 24px --size-lg step: it is the
     optical alignment shared with the host search header's leading slot. */
  .app-icon {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    overflow: hidden;
    border-radius: var(--radius-xs);
  }

  .app-icon img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .app-initial {
    color: var(--text-secondary);
    font-size: var(--font-size-xs);
    font-weight: 600;
  }

  .app-copy {
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-width: 0;
    line-height: 1.2;
  }

  .app-name,
  .app-subtitle {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .app-name {
    color: var(--text-primary);
    font-size: var(--font-size-base);
    font-weight: 500;
  }

  .app-subtitle {
    color: var(--text-tertiary);
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
  }

  /* Text carries the state; the tint only reinforces it. */
  .running-badge {
    padding: var(--space-0-5) var(--space-2);
    border-radius: var(--radius-full);
    background: color-mix(in srgb, var(--accent-success) 12%, transparent);
    color: var(--accent-success);
    font-size: var(--font-size-xs);
    font-weight: 500;
    white-space: nowrap;
  }

  .picker-placeholder,
  .picker-error {
    margin: 0;
    padding: var(--space-4) var(--space-6);
    font-size: var(--font-size-sm);
    text-align: center;
  }

  .picker-placeholder {
    color: var(--text-tertiary);
  }

  .picker-error {
    color: var(--accent-danger);
  }
</style>
