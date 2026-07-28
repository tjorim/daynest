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

1. Open this directory in [CloudPebble](https://cloudpebble.repebble.com/)
   (no local install needed), or install the SDK locally — see
   [Installing the Pebble SDK](https://developer.repebble.com/sdk/). Local
   builds also need `@moddable/pebbleproxy` installed
   (`pebble package install @moddable/pebbleproxy` — already declared in
   `package.json`'s `dependencies`, so a normal build should fetch it).
2. To sideload directly instead of using CloudPebble's install button,
   enable "Developer Connection" in the Pebble mobile app so the `pebble`
   CLI can push builds and stream logs to a paired watch.
3. In the Pebble mobile app, open Daynest's settings and sign in through the
   Daynest configuration webview. Daynest rotates a credential containing only
   `pebble:read` and `pebble:write`, closes the webview, and relays it to the
   watch.

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
