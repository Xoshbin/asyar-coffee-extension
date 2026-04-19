# Coffee — manual cross-platform test checklist

Run every line on each platform before releasing a version.

## Setup per platform
- macOS (Apple Silicon + Intel if possible)
- Linux (systemd-based distro; Wayland and X11 if possible)
- Windows 11

## `caffeinate` (indefinite)
- [ ] Invoke from launcher search.
- [ ] Tray icon switches to ☕, tooltip reads "Caffeinated".
- [ ] `pmset -g` (macOS) / `systemd-inhibit --list` (Linux) / `powercfg /requests` (Windows) shows an Asyar-owned inhibitor.
- [ ] Close the launcher — inhibitor persists.
- [ ] Restart Asyar — tray still shows ☕, inhibitor still live (power.list reattach works).

## `decaffeinate`
- [ ] Invoke from launcher search. Tray returns to 💤 "Decaffeinated".
- [ ] OS inhibitor list is empty for Asyar.

## `caffeinate-toggle`
- [ ] Caffeinates when idle; decaffeinates when active. No double-invocation bugs.

## `caffeinate-for 0h 5m 0s`
- [ ] Tray shows "Caffeinated — 5m left".
- [ ] Close launcher. After ≥5 min wall-clock, inhibitor is auto-released.
- [ ] No expiry notification (by design — silent state transitions).

## `caffeinate-until HH:mm` (~3 min in future)
- [ ] Runs; tray shows remaining time.
- [ ] At target clock time, decaffeinates.

## `caffeinate-while` — known v1 limitation

**macOS:** `InstalledApplication` in the SDK does not expose `bundleIdentifier`, but macOS's `isRunning` only matches by that string. The extension passes `app.name` as a best-effort identifier, which will NOT match on macOS — users will see "X is not running". Treat caffeinate-while as a Linux/Windows-only feature for v1; fix requires extending the SDK's `InstalledApplication` to carry `bundleId`.

**Linux / Windows:**
- [ ] View lists installed apps; filter works.
- [ ] Picking a running app (name matches process name, e.g. `firefox`) starts caffeinate-while.
- [ ] Tray shows "Caffeinated while <name>".
- [ ] Quit the target process → decaffeinates automatically within ~1 s.
- [ ] Quit Asyar while active, relaunch: state rehydrates if the app is still running; resets to idle otherwise.

## `status`
- [ ] Emits a notification describing the current mode + remaining time if applicable.

## `index` (60 s tray tick)
- [ ] Tray's "1h 23m left" label updates at least once per minute without user interaction.

## Preferences
- [ ] `preventDisplay=false` → display sleeps while system stays awake.
- [ ] `preventSystem=false` → system may sleep (watch it happen).
- [ ] macOS: `preventDisk=false` → disk idle permitted.
- [ ] `hideTrayWhenIdle=true` → tray disappears on decaffeinate, reappears on caffeinate.

## Failure paths
- [ ] Linux without logind → `power.keepAwake` rejects with `PowerUnavailable:*`; notification shown; state stays idle.
- [ ] `caffeinate-for 0 0 0` → validation notification; state unchanged.
- [ ] `caffeinate-until 9am` → validation notification; state unchanged.
- [ ] `caffeinate-for 1.5 0 0` (fractional) → validation notification; state unchanged.

## Notes

- No expiry notifications fire on successful timer/app-triggered decaffeinate (silent state transitions).
- Power inhibitor tokens survive Asyar restarts; the extension reattaches via `power.list()` on activate.
- Timers survive Asyar restarts; overdue timers fire on next launch via `ITimerService.schedule` semantics.
