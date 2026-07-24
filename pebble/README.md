# Daynest Pebble companion app (Alloy)

Replaces the removed `android/wear` Wear OS module (#676) with a native
companion app for Pebble Time 2 (Emery), built with
[Alloy](https://developer.repebble.com/guides/alloy/) — Moddable's
JavaScript/TypeScript SDK for PebbleOS.

## Status: early scaffold, not yet hardware-tested

This has been written against the public Alloy documentation and the
[moddable-OpenSource/pebble-examples](https://github.com/moddable-OpenSource/pebble-examples)
reference apps, but **has not been compiled or run on a device or the
emulator** — there's no toolchain available in the environment this was
scaffolded in. Per the plan in #676, validating this by hand in CloudPebble
or the local SDK against a real Pebble Time 2 is the next step, not
something to automate.

Treat everything below as a documented starting point, not a finished app.

## Architecture

Unlike the old Wear OS module, this does **not** need a dedicated native
Android relay service. Alloy's phone-side code (`src/pkjs/index.js`) runs
automatically inside the stock Pebble mobile app once the watchapp is
installed — `@moddable/pebbleproxy` uses that to let `fetch()` calls made
from the watch (`src/embeddedjs/main.js`) reach the internet over the
phone's connection. See
[Alloy networking](https://developer.repebble.com/guides/alloy/networking/).

- **`src/pkjs/index.js`** — wires up the two proxy event listeners. That's
  its entire job; no Daynest-specific code runs on the phone.
- **`src/embeddedjs/main.js`** — the actual app: fetches today's dashboard,
  renders a Piu text screen, caches the last result via
  `device.keyValue` for offline display, and maps the hardware buttons to
  quick actions (UP refresh, SELECT complete, DOWN skip on the first due
  item).
- **`src/embeddedjs/config.js`** (gitignored, copy from `config.example.js`)
  — server URL + integration API key, read at build time.

## A course-correction from the original issue plan

#676 says to reuse `/api/today` and the today-actions endpoints. That's
**not quite right**: `/api/today` (`backend/app/api/routes/today.py`) is
wired to `get_current_user`, which only accepts an interactive OIDC bearer
token — it does not accept an integration API key. The endpoints that
*do* accept the integration-client key
(`backend/app/api/dependencies/integration_auth.py`'s
`require_integration_auth`) are the Home Assistant integration routes under
`/api/integrations/home-assistant/*`.

This app calls those instead:

- `GET /api/integrations/home-assistant/dashboard` — due/overdue counts
  plus a `due_today` list (`chore_instance_id`, `title`, `status`) —
  enough for a glance view and to know what SELECT/DOWN act on.
- `POST /api/integrations/home-assistant/actions/complete-task` /
  `.../actions/skip-task` — body `{ "chore_instance_id": <int> }`.

This works today with zero backend changes, but the naming is borrowed from
a Home Assistant-flavored surface. If this app graduates past a prototype,
consider whether a dedicated `/api/integrations/pebble/...` router (still
using `require_integration_auth`) is worth the small amount of backend
work, rather than permanently piggybacking on the HA routes.

## Setup

1. Get an integration API key: Daynest web app → Settings → Integration
   Clients → create one. Copy the key shown once at creation time.
2. `cp src/embeddedjs/config.example.js src/embeddedjs/config.js` and fill
   in `API_BASE_URL` (your Daynest server, no trailing slash) and
   `API_INTEGRATION_KEY`.
3. Open this directory in [CloudPebble](https://cloudpebble.repebble.com/)
   (no local install needed), or install the SDK locally — see
   [Installing the Pebble SDK](https://developer.repebble.com/sdk/). Local
   builds also need `@moddable/pebbleproxy` installed
   (`pebble package install @moddable/pebbleproxy` — already declared in
   `package.json`'s `dependencies`, so a normal build should fetch it).
4. To sideload directly instead of using CloudPebble's install button,
   enable "Developer Connection" in the Pebble mobile app so the `pebble`
   CLI can push builds and stream logs to a paired watch.

## Known gaps / next steps

- **Config entry has no on-watch UI.** `config.js` is a build-time file,
  not a runtime settings screen — there's no way to change the server URL
  or key without rebuilding. Alloy supports a `Settings`-module-backed
  configurable webview for this
  ([App Configuration guide](https://developer.rebble.io/guides/user-interfaces/app-configuration/)),
  which would need a small hosted HTML page; not built here.
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
  deliberately simple since the exact Piu list/scroller component API
  wasn't verified against working examples during scaffolding. Piu's
  `Container`/`Content`/`Text` primitives used here (`add`/`content(name)`/
  `.string`) are confirmed against
  [Moddable's Piu reference](https://github.com/Moddable-OpenSource/moddable/blob/public/documentation/piu/piu.md);
  a richer per-item list is a good next iteration once this boots on
  hardware.
- **Storage/offline behavior**: cached via `device.keyValue`; Pebble's docs
  don't document a hard size limit for Emery, just "keep it minimal" — the
  cached payload here is a single small JSON blob, which should be safe.
