# Daynest Pebble companion app (Alloy)

Replaces the removed `android/wear` Wear OS module (#676) with a native
companion app for Pebble Time 2 (Emery), built with
[Alloy](https://developer.repebble.com/guides/alloy/) — Moddable's
JavaScript/TypeScript SDK for PebbleOS.

## Status: builds and runs; live data still needs a real watch

The package builds for Emery and Gabbro against Pebble SDK 4.17, and the
watchapp installs, launches, and renders on the Emery QEMU emulator. Two
defects that prevented each of those are fixed — see
[Validation notes](#validation-notes).

Everything behind a live network call is still unverified. Watch-side
`fetch()` never completes under QEMU + pypkjs: the request is queued and the
HTTP proxy never receives it, because the Moddable AppMessage channel it rides
on never becomes writable in the emulator (PebbleOS gates that on a system comm
session pypkjs doesn't establish). A minimal fetch-only app containing no
Daynest code stalls identically, so this is an emulator limit rather than an
app bug (see [`EMULATOR.md`](EMULATOR.md)) — but it does mean the dashboard
load, complete/skip actions, offline cache fallback, and the mutation-replay
guards can only be signed off on hardware. Work through the
[hardware smoke test](#hardware-smoke-test) on a Pebble Time 2 before treating
those as done.

## Architecture

Unlike the old Wear OS module, this does **not** need a dedicated native
Android relay service. Alloy's phone-side code (`src/pkjs/index.js`) runs
automatically inside the stock Pebble mobile app once the watchapp is
installed — `@moddable/pebbleproxy` uses that to let `fetch()` calls made
from the watch (`src/embeddedjs/main.js`) reach the internet over the
phone's connection. See
[Alloy networking](https://developer.repebble.com/guides/alloy/networking/).

- **`src/pkjs/index.js`** — wires up the network proxy and the standard
  Pebble configuration flow, then relays the server URL and integration key
  to the watch.
- **`src/embeddedjs/main.js`** — the actual app: fetches today's dashboard,
  renders a Piu text screen, caches the last result via
  `device.keyValue` for offline display, and maps the hardware buttons to
  quick actions (UP refresh, SELECT complete, DOWN skip on the first due
  item).
- **`frontend/src/features/pebble/PebblePairPage.tsx`** — authenticated
  configuration page that creates or rotates a Pebble-scoped integration key
  and returns it directly to the Pebble mobile app.

## A course-correction from the original issue plan

Issue #676 says to reuse `/api/today` and the today-actions endpoints. That's
**not quite right**: `/api/today` (`backend/app/api/routes/today.py`) is
wired to `get_current_user`, which only accepts an interactive OIDC bearer
token — it does not accept an integration API key.

There's now a dedicated, narrow router for this app:
`backend/app/api/routes/integrations/pebble.py`, guarded by
`require_integration_auth` with scoped permissions (see
`docs/authorization-model.md`) — a key created for Pebble cannot reach the
Home Assistant integration routes or vice versa:

- `GET /api/integrations/pebble/dashboard` (needs `pebble:read`) —
  due/overdue counts plus a `due_today` list (`chore_instance_id`, `title`,
  `status`) — enough for a glance view and to know what SELECT/DOWN act on.
- `POST /api/integrations/pebble/actions/complete-task` /
  `.../actions/skip-task` (needs `pebble:write`) — body
  `{ "chore_instance_id": <int> }`.

## Setup

### Toolchain

These are the exact steps used to build and run the package. On Ubuntu:

```sh
sudo apt install nodejs npm libsdl2-2.0-0 libglib2.0-0 libpixman-1-0 zlib1g
uv tool install pebble-tool     # needs Python 3.10+; see https://docs.astral.sh/uv/
pebble sdk install latest       # installs SDK 4.17 + the ARM/Moddable toolchain
```

[CloudPebble](https://cloudpebble.repebble.com/) works too and needs no local
install. `@moddable/pebbleproxy` is declared in `package.json`'s
`dependencies`, and `pebble build` fetches it automatically — no separate
`pebble package install` step is needed.

### Build and run

```sh
cd pebble
pebble build                              # → build/pebble.pbw (emery + gabbro)
pebble install --emulator emery           # or: --phone <ip> for a paired watch
pebble logs --emulator emery
```

To sideload to a real watch, enable "Developer Connection" in the Pebble mobile
app so the `pebble` CLI can push builds and stream logs.

`node scripts/validate.mjs` runs the contract checks (message keys, target
platforms, required scopes, and the footguns described below). It does not need
the SDK. CI runs that, plus a real `pebble build` and an emulator boot that
screenshots the app and asserts it rendered — a watchapp that dies at startup
compiles cleanly and logs nothing, so the screenshot is the only thing that
catches it.

[`EMULATOR.md`](EMULATOR.md) is the runbook for the Emery emulator: how to drive
the app without a phone, how to debug a watchapp that renders nothing and logs
nothing, and which environment quirks to expect.

### Pairing

In the Pebble mobile app, open Daynest's settings and sign in through the
Daynest configuration webview. Daynest rotates a credential containing only
`pebble:read` and `pebble:write`, closes the webview, and relays it to the
watch as `API_BASE_URL` / `AUTH_TOKEN`.

## Validation notes

Findings from building and running the package. The fixes are in the code
already; the guards live in `scripts/validate.mjs` so they can't regress.

- **PKJS is bundled by an ES2015-era acorn.** A trailing comma in an argument
  list — ordinary repo formatting style — is a hard `SyntaxError` that fails
  `pebble build`. Keep `src/pkjs/index.js` free of them.
- **Piu fonts come from PebbleOS's built-in table, not from the app.** Only
  `Gothic` (9/14/18/24/28/36), `Bitham`, `Roboto`, `DroidSerif`, and `Leco`
  exist, in regular or bold, and the value is CSS shorthand — `"14px Gothic"`,
  not a font filename. An unknown family throws an uncaught
  `font not found` URIError from `new Style(...)` that kills the app at
  startup, with a blank screen and nothing in `pebble logs` to explain it.
- **`Pebble.sendAppMessage()` bypasses the proxy's send queue.** PKJS allows
  only a few simultaneously enqueued messages and the proxy is already using
  that budget for in-flight `fetch()` traffic, so `src/pkjs/index.js` relays
  the pairing token through `moddableProxy.sendAppMessage()` instead.
- **Watch-side `console.log` does not reach `pebble logs` in release builds** —
  only PKJS output does. Debugging the watchapp means either rendering state to
  the screen or a `pebble build --debug` xsbug session.
- **Emery renders the whole glance comfortably.** At `14px Gothic` on 200×228,
  the header, counts, four items, and the action hint all fit, and `—`, `•`,
  and `…` all have glyph coverage. Consecutive newlines collapse, so the empty
  strings used as separators in `renderDashboard()` produce no blank line.
- **Message keys are assigned numerically by the build** — `API_BASE_URL` is
  10000 and `AUTH_TOKEN` is 10001, clear of the proxy's 15000+ range. Pushing
  them by hand (`pebble send-app-message --emulator emery --string
  10000=<url> 10001=<key>`) is the quickest way to exercise the config path
  without standing up the pairing webview.

## Hardware smoke test

Everything below needs a paired Pebble Time 2, because the emulator can't
complete a watch-side `fetch()`.

- [ ] The app installs and starts from the Pebble mobile app.
- [ ] Daynest's configuration page opens from the stock Pebble app, and after
      sign-in the watch leaves the "Not configured" screen.
- [ ] The glance shows live due-today/overdue counts and the first due items.
- [ ] UP refreshes; SELECT completes the first due item; DOWN skips it.
- [ ] Repeated SELECT/DOWN presses submit the mutation exactly once (check the
      backend, not just the screen).
- [ ] With networking off, the last dashboard is still shown and is labelled
      `(cached — offline)`.
- [ ] After a successful mutation, a failed refresh does not resurrect the
      acted-on item from cache.
- [ ] The integration key works with only `pebble:read` and `pebble:write`.

## Known gaps / next steps

- **No AppGlance or Timeline pins yet.** The Pebble-native equivalents of
  the Wear OS tile/complication — pushing "3 due today" straight to the
  launcher via the
  [AppGlance REST API](https://developer.repebble.com/guides/user-interfaces/appglance-rest/),
  and actionable
  [Timeline pins](https://developer.repebble.com/guides/pebble-timeline/pin-structure/)
  for complete/skip without opening the app — are a better long-term fit
  than a foreground watchapp screen, but need backend work (pushing
  glance/pin updates on `today_updated` events, and a token exchange flow
  for the pin `http` action's `X-Pebble-Account-Token`/
  `X-Pebble-Watch-Token`, which are Pebble's own tokens, not Daynest's).
  This scaffold is the simpler "open the app to see today" version.
- **UI is a single static-text screen**, not a scrollable list — kept
  deliberately simple. The Piu primitives used here
  (`Application.template`/`content(name)`/`.string`) are confirmed working on
  the Emery emulator; a richer per-item list is a good next iteration.
- **Storage/offline behavior**: cached via `device.keyValue`; Pebble's docs
  don't document a hard size limit for Emery, just "keep it minimal" — the
  cached payload here is a single small JSON blob, which should be safe.
