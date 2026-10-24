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
- Use `pnpm` only. `frontend/pnpm-lock.yaml` is the single lockfile.
