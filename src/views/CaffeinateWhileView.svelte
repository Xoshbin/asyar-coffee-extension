<script lang="ts">
  import type {
    ExtensionContext,
    IApplicationService,
    InstalledApplication,
  } from 'asyar-sdk/view';

  let { context } = $props<{ context: ExtensionContext }>();

  let apps = $state<InstalledApplication[]>([]);
  let query = $state('');
  let loadError = $state<string | null>(null);
  let loading = $state(true);
  let filterInput = $state<HTMLInputElement | null>(null);
  let submitting = $state(false);

  $effect(() => {
    const applicationService = context.getService('application') as IApplicationService;
    (async () => {
      try {
        apps = await applicationService.listApplications();
      } catch (err) {
        loadError = err instanceof Error ? err.message : String(err);
      } finally {
        loading = false;
      }
    })();
  });

  // Manual focus on mount avoids the `autofocus` a11y warning.
  $effect(() => {
    filterInput?.focus();
  });

  const filtered = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!q) return apps;
    return apps.filter((a) => a.name.toLowerCase().includes(q));
  });

  async function pick(app: InstalledApplication) {
    if (submitting) return;
    submitting = true;
    // Prefer the native bundle identifier (macOS CFBundleIdentifier /
    // Linux StartupWMClass) populated by the scanner. Falls back to
    // `name` on platforms or entries where the scanner couldn't extract
    // one — the Rust `isRunning` uses process-name matching there, which
    // treats the string as a /proc comm name (Linux) or process name
    // (Windows).
    try {
      await context.request('caffeinateWhile', {
        bundleId: app.bundleId ?? app.name,
        appName: app.name,
      });
      window.parent.postMessage({ type: 'asyar:window:hide' }, '*');
    } catch (err) {
      loadError = err instanceof Error ? err.message : String(err);
      submitting = false;
    }
  }
</script>

<div class="wrap">
  <h1>Caffeinate While…</h1>
  <input
    type="text"
    class="filter-input"
    placeholder="Filter applications"
    bind:value={query}
    bind:this={filterInput}
  />
  {#if loading}
    <p class="muted">Loading applications…</p>
  {:else if loadError}
    <p class="error">{loadError}</p>
  {:else if filtered.length === 0}
    <p class="empty">No applications match "{query}".</p>
  {:else}
    <ul class="app-list">
      {#each filtered as app (app.path ?? app.name)}
        <li>
          <button class="app-row" onclick={() => pick(app)} disabled={submitting}>
            <span class="app-name">{app.name}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .wrap {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: var(--space-6);
    color: var(--text-primary);
    font-family: var(--font-ui);
    font-size: var(--font-size-base);
    background: transparent;
  }

  h1 {
    font-size: var(--font-size-xl);
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 var(--space-5);
    letter-spacing: -0.01em;
  }

  .filter-input {
    width: 100%;
    padding: 7px var(--space-4);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-color);
    background: var(--bg-secondary-full-opacity);
    color: var(--text-primary);
    font-family: var(--font-ui);
    font-size: var(--font-size-base);
    outline: none;
    margin-bottom: var(--space-5);
    transition: border-color var(--transition-fast);
  }

  .filter-input:focus {
    border-color: var(--accent-primary);
  }

  .filter-input::placeholder {
    color: var(--text-tertiary);
  }

  .app-list {
    list-style: none;
    padding: 0;
    margin: 0;
    flex: 1;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb) transparent;
  }

  .app-list li {
    margin: 0;
  }

  .app-row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: var(--space-4);
    text-align: left;
    padding: var(--space-4) var(--space-6);
    border-radius: var(--radius-xl);
    margin-bottom: 1px;
    background: transparent;
    border: none;
    color: var(--text-primary);
    font-family: var(--font-ui);
    font-size: var(--font-size-md);
    cursor: pointer;
    transition: background var(--transition-fast);
  }

  .app-row:hover {
    background: var(--bg-hover);
  }

  .app-row:active {
    background: var(--bg-selected);
  }

  .app-row:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
  }

  .app-row:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .app-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .muted,
  .empty {
    color: var(--text-secondary);
    font-size: var(--font-size-md);
    margin: var(--space-3) 0;
  }

  .error {
    color: var(--accent-danger);
    font-size: var(--font-size-md);
    margin: var(--space-3) 0;
  }
</style>
