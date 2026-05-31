# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Maintainer notes

Before tagging a release, update **all** of the following to match the new version:

| File | Field |
|---|---|
| `python-daynest/pyproject.toml` | `version` |
| `custom_components/daynest/manifest.json` | `version`, `requirements` pin |
| `android/app/build.gradle.kts` | `versionName`, `versionCode` |
| `frontend/package.json` | `version` |
| `dashboard/package.json` | `version` |
| `CHANGELOG.md` | new `## [x.y.z]` section |

**Android `versionCode` convention:** `MAJOR × 1000000 + MINOR × 1000 + PATCH`
Examples: `v0.1.0` → `1000`, `v1.0.0` → `1000000`, `v1.2.3` → `1002003`

The release preflight job enforces all of the above and fails the workflow before any
artifact is built or published if any check fails.

---

## [Unreleased]

## [0.1.9] - 2026-05-31

### Changed
- API prefix simplified from `/api/v1/...` to `/api/...` across the backend, frontend,
  tests, mocks, and python-daynest client — aligns with the other Daynest apps

### Fixed
- MCP: `required_scopes=[]` set on `KeycloakAuthProvider` to fix scope validation errors
  when connecting via Claude or other MCP clients
- Today SSE stream contract hardened and fully documented
- Frontend template API paths corrected after backend route reorganisation

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

[Unreleased]: https://github.com/tjorim/daynest/compare/v0.1.9...HEAD
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
