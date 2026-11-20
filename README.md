# Coffee

> Prevent your computer from sleeping. Cross-platform sleep-prevention utility.

`org.asyar.coffee` is a Tier 2 Asyar extension (utilities · macOS, Windows, Linux).

## What it does

The extension provides **8 commands**:

| Command | Mode | What it does |
| --- | --- | --- |
| **Caffeinate** | `background` | Prevent your computer from sleeping indefinitely |
| **Decaffeinate** | `background` | Release the current caffeination |
| **Toggle Caffeination** | `background` | Caffeinate if idle, decaffeinate if active |
| **Caffeinate For** | `background` | Prevent sleep for a specified duration |
| **Caffeinate Until** | `background` | Prevent sleep until a specified clock time (HH:mm, 24-hour) |
| **Caffeinate While** | `view` | Prevent sleep while a selected application is running |
| **Caffeination Status** | `background` | Show the current caffeination state |
| **Status (Background)** | `background` | Refresh the tray item's elapsed-time label |

## Permissions

```json
"permissions": [
  "power:inhibit",
  "preferences:read",
  "timers:schedule",
  "timers:cancel",
  "timers:list",
  "application:read",
  "app:frontmost-watch",
  "systemEvents:read",
  "notifications:send"
]
```

## Install

Install from the [Asyar Store](https://asyar.org/extensions).

## Develop

```bash
# from this directory
pnpm install
pnpm dev          # vite dev server
pnpm test:run     # vitest
pnpm build        # emits dist/{worker,view}.js + assets
pnpm link         # registers the dev path with the launcher
asyar publish     # builds, packages, GitHub release, store submission
```

## License

[MIT](./LICENSE) © Khoshbin
