# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project's own version (the `## [x.y.z]` headers below, `vYYYY.MM.MICRO`
release tags, frontend/Android/HACS integration) uses
[CalVer](https://calver.org/) — `YYYY.MM.MICRO`, a counter that resets each
month — while `python-daynest`, the PyPI client library, stays on
[Semantic Versioning](https://semver.org/spec/v2.0.0.html) independently,
since HACS/Home Assistant consumers pin against it for compatibility (#673).

## Maintainer notes

`VERSION` (repo root) is the single source of truth for the app's own version.
After bumping it, run `bash scripts/sync-version.sh` to stamp the value into
every file that needs a static, checked-in copy, then update the rest of this
list by hand:

| File | Field | How it's updated |
|---|---|---|
| `VERSION` | contents | hand-edit — the source of truth |
| `frontend/package.json` | `version` | `scripts/sync-version.sh` |
| `dashboard/package.json` | `version` | `scripts/sync-version.sh` |
| `custom_components/daynest/manifest.json` | `version` | `scripts/sync-version.sh` |
| `android/app/build.gradle.kts` | `versionName`, `versionCode` | auto-derived from `VERSION` at build time — never hand-edit |
| `CHANGELOG.md` | new `## [YYYY.MM.MICRO]` section | hand-edit |
| `python-daynest/pyproject.toml` | `version` | hand-edit, **independently** — only bump when the library itself changes, not on every app release |
| `custom_components/daynest/manifest.json` | `requirements` pin | hand-edit to match `python-daynest/pyproject.toml`'s version whenever that changes |

**Android `versionCode` convention:** `MAJOR × 1000000 + MINOR × 1000 + PATCH`,
where `MAJOR.MINOR.PATCH` is `YYYY.MM.MICRO`.
Examples: `v2026.7.1` → `2026007001`, `v2026.12.3` → `2026012003`.

The release preflight job enforces all of the above and fails the workflow before any
artifact is built or published if any check fails. `python-daynest`'s PyPI publish step
skips (rather than fails) when its current version is already published, since it doesn't
bump on every app release.

---

## [2026.7.1] - 2026-07-22

### Changed
- **Versioning:** app version switched from SemVer to CalVer (`YYYY.MM.MICRO`); `python-daynest`
  stays on independent SemVer. `VERSION` (repo root) is now the single source of truth, synced
  to `frontend/package.json`, `dashboard/package.json`, and `manifest.json` via
  `scripts/sync-version.sh`; Android's `versionName`/`versionCode` are derived from it at build
  time (#673).

## [0.1.11] - 2026-07-22

### Fixed
- **Android:** several Retrofit API clients — including OIDC discovery, which blocked sign-in entirely — were still calling the `/api/v1/...` paths removed when the backend's API prefix was simplified to `/api/...` in v0.1.9. Selecting a server and signing in now works again; the same stale prefix was also fixed in the Wear OS module's Today APIs.

## [0.1.10] - 2026-07-22

### Added
- **Backend:** growth-module migration CI now validates shopping lists, recurring groceries, meal planning, and calendar subscription schema after upgrading to Alembic head.
- **MCP:** `GET /api/mcp/capabilities` advertises the mounted MCP server, tools, resources, and prompts, including growth-module shopping and meal planning tools.
- **Backend:** per-client-IP rate limiting on every public REST API route (health probes exempt), configurable via `RATE_LIMIT_ENABLED`/`RATE_LIMIT_DEFAULT` (#670).

## [0.1.9] - 2026-05-31

### Added
- **Frontend:** Bootstrap Icons as the standard icon set; notification preferences in Settings;
  i18n foundation (EN/NL) with Playwright E2E pipeline; recurring planned items UX with RRULE
  form controls, recurrence indicators, and scoped delete; nullable `time_of_day` and
  `duration_minutes` on planned items
- **Backend:** on-demand recurring planned item materialisation via `recurrence_series`;
  medication improvements and planned-item extensions; observability contract extended to
  integration surfaces
- **MCP:** server version stamped from `BUILD_VERSION`; `delete_planned_item_series` tool
  for bulk series removal; RRULE, history limit, and `medication_plan_id` filter exposed
- **Wear OS:** initial companion app with tile, complication, and quick-action support in a
  dedicated `:wear` Gradle module
- **Android:** Material You theme and template management screens; offline sync queue,
  notification plumbing, biometric resume gate, and system calendar sync
- **Household:** shared mode for multi-user chore sharing across a household

### Changed
- API prefix simplified from `/api/v1/...` to `/api/...` — update any direct API integrations

### Fixed
- MCP: `required_scopes=[]` set on `KeycloakAuthProvider` to fix scope validation errors
- Today SSE stream contract hardened and fully documented
- Frontend template API paths corrected after backend route reorganisation
- Home Assistant: CVEs patched in `zeroconf` and `uv` dependencies

## [0.1.8] - 2026-05-23

### Added
- **Frontend:** dark mode, timezone selector, stats page, search overlay, streak badges,
  drag-to-reschedule on the calendar view
- **Backend:** user settings, bulk mutations, priority/tags, RRULE recurrence,
  template REST paths, export/import, full-text search, and streak tracking
- **Backend:** on-demand recurring planned item materialisation via `recurrence_series`
- **Backend:** Today SSE stream and push notification infrastructure
- **MCP:** server migrated to standalone `fastmcp`; version stamped from `BUILD_VERSION`;
  new tools for series deletion, RRULE filtering, and full medication plan CRUD
- **Home Assistant:** typed calendars and derived entities, coordinator-driven event bus,
  writable settings, multi-view Lovelace card UX, and to-do entity with write support
- **Wear OS:** initial companion app with tile, complication, and quick-action support
  in a dedicated `:wear` Gradle module
- **Android:** offline sync queue, notification plumbing, biometric resume gate,
  system calendar sync, and Material You + template management screens
- **python-daynest:** complete typed CRUD and calendar API, SSE subscription helper,
  and client-side TTL caching

## [0.1.7] - 2026-05-23

### Fixed
- Correct entity IDs and `CalendarEntityDescription` for the HA Lovelace card
- Separate third-party and first-party imports in `calendar.py`

## [0.1.6] - 2026-05-20

### Fixed
- Register Daynest Lovelace card as a frontend resource so it loads in the HA dashboard

## [0.1.5] - 2026-05-20

### Added
- Single-URL OIDC discovery: all clients can now resolve the issuer, auth, and token
  endpoints from a single server URL via `GET /api/auth/oidc-config`
- Android: OIDC config fetch errors now include HTTP status and response body before
  JSON parsing fails
- Backend: OIDC discovery URLs validated with Pydantic `HttpUrl`

## [0.1.4] - 2026-05-20

### Added
- `GET /api/auth/oidc-config` endpoint so the HA integration can discover the Daynest
  OIDC issuer and auth/token endpoints without hardcoding them in the config flow

## [0.1.3] - 2026-05-20

### Added
- Home Assistant config flow migrated to browser-based OAuth PKCE redirect flow,
  replacing the previous manual client-credentials setup
- Re-authentication support: expired or revoked sessions prompt sign-in again
  without removing the integration
- Entry migration v4 → v5 to backfill OAuth redirect fields for existing installs
- Lovelace card re-fetches tasks on `last_updated` attribute changes,
  not only on `last_changed` state changes

### Fixed
- Token endpoint now issues short-lived JWTs instead of echoing the long-lived
  client secret as the access token

## [0.1.2] - 2026-05-20

### Added
- Revoke and rotate actions for integration clients in the Settings page
- API key rotation support for integration clients
- Home Assistant integration migrated to Keycloak client credentials flow
- MCP scopes split into `mcp:read` and `mcp:write`

### Fixed
- OAuth session client type annotations and response rendering

## [0.1.1] - 2026-05-20

### Fixed
- HACS zip was double-nested under `custom_components/daynest/`; archive now extracts
  to the correct location for HACS installation

## [0.1.0] - 2026-05-20

### Added
- Initial release: React/Vite frontend, FastAPI backend, Docker Compose setup
- HACS-compatible Home Assistant custom integration with Lovelace dashboard card
- `python-daynest` Python async client library, published to PyPI
- Android app with Keycloak OIDC authentication, MCP parity screens, and release APK workflow
- MCP server with Keycloak OIDC auth and medication plan CRUD tools
- Tag-driven GitHub Release workflow publishing HACS zip, Android APK, and python-daynest to PyPI

[Unreleased]: https://github.com/tjorim/daynest/compare/v2026.7.1...HEAD
[2026.7.1]: https://github.com/tjorim/daynest/compare/v0.1.11...v2026.7.1
[0.1.11]: https://github.com/tjorim/daynest/compare/v0.1.10...v0.1.11
[0.1.10]: https://github.com/tjorim/daynest/compare/v0.1.9...v0.1.10
[0.1.9]: https://github.com/tjorim/daynest/compare/v0.1.8...v0.1.9
[0.1.8]: https://github.com/tjorim/daynest/compare/v0.1.7...v0.1.8
[0.1.7]: https://github.com/tjorim/daynest/compare/v0.1.6...v0.1.7
[0.1.6]: https://github.com/tjorim/daynest/compare/v0.1.5...v0.1.6
[0.1.5]: https://github.com/tjorim/daynest/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/tjorim/daynest/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/tjorim/daynest/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/tjorim/daynest/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/tjorim/daynest/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/tjorim/daynest/releases/tag/v0.1.0
