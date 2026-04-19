<script lang="ts">
  import type { ExtensionContext, IApplicationService, InstalledApplication } from 'asyar-sdk';

  let { context, coffeeExtension } = $props<{
    context: ExtensionContext;
    coffeeExtension: {
      controller: {
        caffeinateWhile: (input: { bundleId: string; appName: string }) => Promise<void>;
      };
    };
  }>();

  const applicationService = context.getService<IApplicationService>('application');

  let apps = $state<InstalledApplication[]>([]);
  let query = $state('');
  let loadError = $state<string | null>(null);
  let loading = $state(true);

  $effect(() => {
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

  const filtered = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!q) return apps;
    return apps.filter((a) => a.name.toLowerCase().includes(q));
  });

  async function pick(app: InstalledApplication) {
    // `InstalledApplication` has no `bundleId` field. On Linux the Rust
    // `isRunning` treats the arg as a /proc comm name (exe basename);
    // on Windows it's a process name. Passing `app.name` works there.
    // On macOS `isRunning` requires the real bundleIdentifier
    // (e.g. "com.apple.Safari") which is unavailable — that path is a
    // known v1 limitation and tracked in docs/manual-test.md.
    await coffeeExtension.controller.caffeinateWhile({
      bundleId: app.name,
      appName: app.name,
    });
    window.parent.postMessage({ type: 'asyar:window:hide' }, '*');
  }
</script>

<div class="wrap">
  <h1>Caffeinate While…</h1>
  <input
    type="text"
    placeholder="Filter applications"
    bind:value={query}
    autofocus
  />
  {#if loading}
    <p class="muted">Loading applications…</p>
  {:else if loadError}
    <p class="error">Failed to load applications: {loadError}</p>
  {:else if filtered.length === 0}
    <p class="muted">No applications match "{query}".</p>
  {:else}
    <ul>
      {#each filtered as app (app.path ?? app.name)}
        <li>
          <button onclick={() => pick(app)}>
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
  .muted { color: #888; }
  .error { color: #c33; }
</style>
