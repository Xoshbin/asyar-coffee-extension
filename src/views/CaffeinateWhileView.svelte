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
    placeholder="Filter applications"
    bind:value={query}
    bind:this={filterInput}
  />
  {#if loading}
    <p class="muted">Loading applications…</p>
  {:else if loadError}
    <p class="error">{loadError}</p>
  {:else if filtered.length === 0}
    <p class="muted">No applications match "{query}".</p>
  {:else}
    <ul>
      {#each filtered as app (app.path ?? app.name)}
        <li>
          <button onclick={() => pick(app)} disabled={submitting}>
            {app.name}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .wrap { padding: 16px; font-family: system-ui, -apple-system, sans-serif; }
  h1 { font-size: 18px; margin: 0 0 12px; }
  input {
    width: 100%;
    padding: 8px;
    font-size: 14px;
    border: 1px solid #ccc;
    border-radius: 4px;
    margin-bottom: 12px;
  }
  ul { list-style: none; padding: 0; margin: 0; max-height: 60vh; overflow: auto; }
  li { margin: 0; }
  button {
    width: 100%;
    text-align: left;
    padding: 8px 12px;
    background: transparent;
    border: 0;
    font-size: 14px;
    cursor: pointer;
  }
  button:hover { background: rgba(0,0,0,0.05); }
  button:disabled { opacity: 0.5; cursor: default; }
  .muted { color: #888; }
  .error { color: #c33; }
</style>
