# Release validation: interactive auth on real clients

Automated tests cover the authorization rules. This runbook covers what they
cannot: the interactive login/logout flows on a real browser, a real Android
device, and a real phone + Pebble watch.

Run it against the production authorization stack. Do not enable compatibility
fallbacks, do not point a client at a mock or dev issuer, and do not reuse a
session established before the build under test was deployed. A pass recorded
against a fallback path is not a pass.

Copy the tables in "Record" into the tracking issue and fill them in as you go.

## Preflight

1. Deploy the build under test and run the backend migration:

   ```sh
   uv run alembic upgrade head
   ```

2. Record the versions from the sources below. `VERSION` is the single source
   of truth; `scripts/sync-version.sh` stamps it into the other files, so a
   mismatch here means the release was cut without running it.

   | What | Where |
   | --- | --- |
   | App version | `VERSION` |
   | Frontend build | `frontend/package.json` version, plus the deployed commit SHA |
   | Android | `versionName` / `versionCode` in the installed APK (both derive from `VERSION`) |
   | Pebble app | `pebble/package.json` version, UUID `f31cdd67-ec60-4220-9508-7316ba0f1dd7` |
   | Watch | PebbleOS version and model (builds target `emery` and `gabbro`) |
   | Phone | OS version, and the Pebble/Alloy companion app version |
   | Browser | Name and version |
   | Keycloak | Realm and server version |

3. Confirm `GET /api/auth/oidc-config` returns the production issuer. Every
   client discovers its endpoints through this one route, so a wrong issuer
   here invalidates all three flows.

4. Confirm the web and Android Keycloak clients are **distinct client IDs**.
   `docs/authorization-model.md` requires separate public clients so redirect
   URIs, logout URIs, and session revocation stay unambiguous. Both clients
   default to `daynest` (`VITE_OIDC_CLIENT_ID` on web, the `OIDC_CLIENT_ID`
   build config field on Android), so a deployment that leaves the web default
   in place collapses them into one. If they are not distinct, stop and open a
   follow-up before validating logout — shared-client logout results are not
   meaningful.

## A. Web

Sign-in state lives in `sessionStorage`, and the app requests
`openid profile email` only — no `offline_access`.

1. Open the app in a fresh private window. Confirm you are redirected to the
   real Keycloak login page at the production issuer.
2. Sign in. Confirm you land back on the page you started from (or `/today`
   when you started on an auth route), not on a blank callback screen.
3. Confirm authenticated app access: the Today screen renders your data.
4. Confirm authenticated API access: with devtools open, verify a request to
   `/api/auth/me` returns 200 and your account. Copy the `Authorization`
   bearer value from that request — you need it in step 7.
5. Open Settings → the OAuth sessions section and confirm the new session is
   listed. This reads through the backend from Keycloak's Account API, so it
   also proves the provider agrees a session exists.
6. Sign out. Confirm you are redirected to Keycloak's end-session endpoint and
   returned to the app origin, signed out.
7. Confirm the session is no longer usable:
   - Replay the token from step 4 against `/api/auth/me` (curl is fine).
     Expect 401 — the client signs out with `revokeTokensOnSignout`, so the
     token must be dead server-side, not merely dropped by the browser.
   - Reload the app. Expect the signed-out state and a required login.
   - Confirm `sessionStorage` holds no `oidc.*` user entry.
8. Confirm the session is gone from Settings → OAuth sessions after signing
   back in.

## B. Android

Use a real device, not an emulator. AppAuth state is persisted in encrypted
storage; sign-out clears it.

1. Install the build under test over a **clean** state (fresh install, or
   clear app storage). Do not test against a session created by an older
   build.
2. Start login. Confirm the handoff leaves the app for the system browser /
   Custom Tab showing the production Keycloak page — not an in-app WebView.
3. Sign in. Confirm the browser hands back to the app via the
   `<applicationId>:/oauth2redirect` redirect and the app shows the signed-in
   state.
4. Confirm authenticated app access: the Today screen renders your data.
5. Confirm authenticated API access: exercise a screen that writes (complete a
   task) and confirm it persists after a pull-to-refresh.
6. Background the app, wait past the access-token lifetime, and reopen it.
   Confirm it refreshes silently and does not bounce you to login — Android
   requests `offline_access` for exactly this.
7. Confirm the new session appears in Settings → OAuth sessions on web,
   attributed to the Android client (this is the check that fails if
   preflight step 4 was skipped and both clients share an ID).
8. Sign out. Confirm the end-session flow opens and completes.
9. Confirm a fresh login is required:
   - Reopen the app. Expect the signed-out state.
   - Force-stop and reopen. Expect the signed-out state — this catches state
     that was only cleared in memory.
   - Start login again. Expect a full Keycloak credential prompt, not a silent
     re-authorization from a surviving provider session.

## C. Pebble

The watch never talks to Keycloak. The phone opens the app's configuration
page, the web session mints a scoped integration key, and the key is relayed
to the watch over app messages. Validate the whole chain, not just that the
watch eventually shows data.

1. Install the build under test on the watch and confirm the companion app is
   paired and connected.
2. From the phone's Pebble app, open the Daynest app's settings. Confirm it
   opens `https://daynest.tjor.im/pebble-pair` in the phone browser/webview.
3. Confirm the page redirects into the real Keycloak login and complete it.
   If the phone already has a web session, sign out first — an untested
   silent path is not a validated login.
4. Confirm the page reports success and the webview closes on its own.
5. Confirm the handoff reached the watch: the watch app leaves
   "Waiting for phone…" and renders the Today glance with live counts. A
   stale-marked ("Last known") render is **not** a pass — it can come from
   the watch's 12-hour cache rather than the new token. Clear the watch app's
   storage (reinstall) before this step if you are unsure.
6. Confirm the token is live in both directions: complete a task from the
   watch quick actions and confirm it appears completed on web. This
   exercises `pebble:write`, which the read path does not.
7. Confirm the pairing is recorded: on web, Settings → Integration Clients
   shows a "Pebble watch" client.
8. If anything stalls, capture phone-side logs — `src/pkjs/index.js` logs
   `pairing token relayed to watch` on success and
   `failed to relay pairing token` / `failed to parse pairing response` on
   failure, which distinguishes a web-side failure from a relay failure.

## D. No-fallback assertions

Run these after the three flows pass. They are what separates release
validation from a smoke test.

- The Pebble integration client created in C.7 has scopes exactly
  `pebble:read` and `pebble:write`. If it carries `integration:*`, the
  migration-only compatibility scope is in play and the run does not count.
- The Pebble key cannot cross adapters: a request to a
  `/api/integrations/home-assistant/*` route with the Pebble key is rejected.
- No client authenticated against a non-production issuer at any point —
  re-check `/api/auth/oidc-config` after the run in case the deployment
  changed underneath you.
- The web app did not request `offline_access` (check the authorize request's
  `scope` parameter in devtools).

## Record

Per-flow result:

| Flow | Build / device versions | Result | Evidence |
| --- | --- | --- | --- |
| Web login | | | |
| Web logout + session unusable | | | |
| Android login | | | |
| Android logout + fresh login required | | | |
| Pebble pairing handoff | | | |
| No-fallback assertions | | | |

Attach for each row: the versions from Preflight step 2, a screenshot of the
signed-in state, and — for the logout rows — the 401 response body from the
replayed token.

## Follow-ups

Open one focused issue per failure or inconsistency, not a single omnibus
issue. Each should name the flow, the exact step number from this runbook, the
versions from Preflight, and the observed vs. expected behavior. Link them
back to the validation issue so a re-run can tell which failures are known.
