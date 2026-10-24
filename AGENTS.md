# Repository guidance

## UI dependency maintenance

Follow [docs/ui-maintenance.md](docs/ui-maintenance.md) for Base UI/runtime updates and direct dialog maintenance. Run `pnpm ui:check` from `frontend/` after changing shared UI. Dependabot does not update owned component source; preserve the documented customisations and validate interactions and bundle budgets.

Application UI imports use `@/components/ui/<component>`. Direct Base UI subpath imports belong in inventoried UI adapters or exact documented composition exceptions. `pnpm ui:check` enforces the policy; `pnpm ui:test` tests it. Keep styles and application behaviour when aligning imports.

## Styling: Tailwind and Base UI alongside Bootstrap

Bootstrap is still the design system while the frontend migrates (tracking issue #933). New and touched components may use Tailwind v4 utilities and Base UI; do not rewrite untouched Bootstrap screens as a side effect.

- `frontend/src/tailwind.css` owns the cascade. Bootstrap, Bootstrap Icons and the Schedule-X theme are imported into named layers below `components` and `utilities` (`theme, base, bootstrap, schedule-x, components, utilities`), so a Tailwind utility beats a conflicting Bootstrap rule such as `.btn` or `.card`. Never import Bootstrap or a vendor stylesheet unlayered, and do not import Tailwind's preflight while Bootstrap's reboot is in charge. Bootstrap's own `!important` utilities (`.d-flex`, `.p-2`, ...) still win, so do not mix them with a Tailwind utility for the same property.
- `dark:` follows the `data-bs-theme="dark"` attribute set by `ThemeProvider`, not the OS setting. That attribute is the only theming switch: never add a `prefers-color-scheme` media query. Brand, link and surface colours are `--color-*` tokens in `tailwind.css` (dark values overridden under `[data-bs-theme="dark"]`); the `--bs-*` overrides in `app.css` only bridge Bootstrap to them. The Schedule-X calendar is switched with `calendar.setTheme(resolvedTheme)`.
- Write a new component as a Base UI primitive in `src/components/ui/` styled with Tailwind utilities and the `cn` helper from `@/lib/utils`; icons come from `lucide-react`. `components.json` pins the Base UI base (`base-nova`) for the shadcn tooling, but `ui-maintenance.json` stays in `base-ui` mode: add components by hand and inventory them as described in `docs/ui-maintenance.md`.
- `pnpm lint` runs `@shadcn/lint` through `frontend/oxlint.config.ts`: no arbitrary values (`w-[10px]`), no raw palette colours (`bg-red-500`), no inline styles (pass dynamic values through a CSS custom property, e.g. `w-(--completion-percent)`), and no unknown classes. Declare one-off sizes with `@utility` in `tailwind.css`.
- Existing Bootstrap and app classes are allowed through a list generated from the stylesheets themselves in `oxlint.config.ts`. Do not edit it by hand; it shrinks as the stylesheets go.
- Use `pnpm` only. `pnpm-lock.yaml` is the single lockfile in `frontend/`.
