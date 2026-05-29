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

## [0.1.0] - 2026-04-25

### Added

- Initial scaffold: frontend (React/Vite), backend (FastAPI), Docker
- Python client library (`python-daynest`) for the Daynest API
- Home Assistant custom integration with HACS packaging
- Android app with release APK workflow
- Tag-driven draft GitHub Release workflow

[Unreleased]: https://github.com/tjorim/daynest/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/tjorim/daynest/releases/tag/v0.1.0
