# Repository guidance

## UI dependency maintenance

Follow [docs/ui-maintenance.md](docs/ui-maintenance.md) for Base UI/runtime updates and direct dialog maintenance. Run `pnpm ui:check` from `frontend/` after changing shared UI. Dependabot does not update owned component source; preserve the documented customisations and validate interactions and bundle budgets.

Application UI imports use `@/components/ui/<component>`. Direct Base UI subpath imports belong in inventoried UI adapters or exact documented composition exceptions. `pnpm ui:check` enforces the policy; `pnpm ui:test` tests it. Keep styles and application behaviour when aligning imports.

## Styling: Tailwind and Base UI

- Use unprefixed Tailwind v4 utilities (`px-4`, `dark:bg-popover`, `max-w-lg`). Bootstrap and its icon font have been removed; do not add their packages or classes.
- `frontend/src/tailwind.css` owns tokens, document defaults and custom utilities. The cascade is `theme, base, schedule-x, components, utilities`; import vendor styles into a named layer below utilities. The owned base layer preserves the existing typography and native controls, so do not add a second reset or preflight without comparing every screen.
- `dark:` follows `data-theme="dark"` on `<html>`, set by `ThemeProvider`. This is the only theme switch: never add a `prefers-color-scheme` media query. Use semantic `--color-*` tokens; the calendar follows `calendar.setTheme(resolvedTheme)`.
- Write new shared controls in `src/components/ui/` with Base UI primitives, Tailwind and `cn` from `@/lib/utils`. Before implementing or restyling UI, check the shared controls, the configured Base UI shadcn registry equivalents and official docs; record keep/extend/replace and consumer coverage in [the coverage audit](docs/ui-registry-coverage.md). Check existing controls first: buttons, alerts, badges, cards, fields, form inputs, lists, tables, progress, spinners and dialogs are already available. Icons use `lucide-react`; keep decorative icons hidden from assistive technology and label icon-only controls.
- `components.json` pins `base-nova` and Lucide; `ui-maintenance.json` stays in `base-ui` mode. Inventory hand-written components as described in `docs/ui-maintenance.md`.
- `pnpm lint` enforces no arbitrary values, raw palette colours, inline styles or unknown classes, with no class allow-list. Define named one-off sizes/styles with `@utility` in `tailwind.css`. Pass dynamic values through CSS custom properties.
- Compare changed views against `main` in light/dark at 1280px and 390px. Preserve the documented breakpoints, native-control sizes and keyboard interactions.
- Use `pnpm` only. Each package has a single lockfile: `frontend/pnpm-lock.yaml` and `dashboard/pnpm-lock.yaml`.

## Releases

The app uses CalVer, `YYYY.M.MICRO` (`MICRO` counts releases within a month), tagged `vYYYY.M.MICRO`. The
root `VERSION` file is the single source of truth; `release.config.json` lists the files that carry a
checked-in copy (`frontend/package.json`, `dashboard/package.json`, `custom_components/daynest/manifest.json`).
`android/app/build.gradle.kts` reads `VERSION` at build time and must never be hand-edited. Its
`versionCode` is `MAJOR × 1000000 + MINOR × 1000 + PATCH` of `YYYY.M.MICRO` (`v2026.7.1` → `2026007001`).

`python-daynest` (PyPI) keeps its **own SemVer** in `python-daynest/pyproject.toml` (#673): bump it only
when the library changes, and keep the `python-daynest==` pin in `manifest.json` equal to it. The release
workflow checks that pin and skips the PyPI publish when the version is already published.

1. Add entries under `## [Unreleased]` in `CHANGELOG.md` while working (`### Added`, `### Changed`,
   `### Fixed`, `### Removed`). Put backend, infrastructure, CI and dependency changes under `### Internal`:
   apps hide that heading from users. Prefix a bullet with `**Android:**` (any scope in
   `release.config.json`) when it only applies to one client.
   `node scripts/release.mjs export --audience app --platform android` prints what an app should show.
2. `node scripts/release.mjs bump` writes the next version into `VERSION` and every file above and turns
   `[Unreleased]` into the dated release section with compare links. Review the diff, open the release PR
   and merge it.
3. Push tag `vYYYY.M.MICRO`. `.github/workflows/release.yml` re-checks the tag, versions and changelog
   (`node scripts/release.mjs check --tag`), publishes `python-daynest` if needed, builds the HACS archive
   and Android APK, and creates a **draft** GitHub release whose notes are the changelog section.

`node scripts/release.mjs check` also runs in CI on every pull request.
