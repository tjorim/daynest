# Bootstrap removal validation

Baseline: `11c8ea5f1e18785f435c6fa1311907618b58763c` (the checkout's main baseline).
Node 24.14.0, pnpm 10.33.0; same dependency versions except removal of Bootstrap,
Bootstrap Icons and their unused Popper dependency. Production builds use `pnpm build`.

## Production asset bytes

Totals across `dist/assets`, grouped by extension; gzip compresses each file independently
with Python's default gzip level. These totals include lazy routes, rather than only entry assets.

| Asset | Before raw | Before gzip | After raw | After gzip |
| --- | ---: | ---: | ---: | ---: |
| CSS | 382,128 | 56,938 | 67,845 | 14,060 |
| JavaScript | 1,529,144 | 457,274 | 1,528,608 | 458,995 |
| Icon fonts | 314,300 | 313,531 | 0 | 0 |

## Checks

- `pnpm lint`: passes with strict unknown-class checking and no allow-list; existing
  unrelated warnings remain in locale tooling and live-update tests.
- `pnpm format:check`: passes.
- `pnpm ui:check` and `pnpm ui:test`: pass (22 tooling tests).
- `pnpm test --maxWorkers=2`: 37 files, 210 tests pass.
- `pnpm build` (includes TypeScript) and `pnpm build:mock`: pass.
- `pnpm exec playwright test --workers=2`: 58 pass, including four temporary screenshot
  capture cases removed after verification (54 permanent cases). Covers dialogs,
  keyboard/focus/dismissal, axe accessibility, settings, calendar and live theme changes.
- Source/dependency grep: no removed packages, `bi-*`, `data-bs-theme`, `--bs-*`,
  temporary `tw:` prefixes or legacy component/utility class strings remain.

Vite still reports its existing future native-config-loader warning. No bundle budgets
were raised.

## Visual comparison

Captured Today, Settings, Calendar and Meal Plan with clean mock builds, in light
and dark at 1280×900 and 390×900, before and after removal (32 PNGs). Each capture
asserts the intended view is rendered before saving, including the calendar wrapper
and meal slots. Baseline and current builds run on separate local ports.

A visual comparison caught and fixed a Card flex/grid conflict in the meal planner;
two permanent responsive layout cases now assert that its seven days stay in one row,
and that the desktop week controls stay on one row. Final focused verification passes
all six layout/capture cases after the week picker and icon-row size adjustments.

The accompanying `daynest-938-screenshots.zip` contains the before/after PNGs for PR
attachment; generated screenshots are not committed as application source.

Every final screenshot pair has identical dimensions. Changed pixels above a
10/255 channel threshold range from 0.024% to 1.373% (icons, small icon-row alignment
and the local server port text differ). Rendered calendar, meal planner, settings
and Today captures were visually inspected across desktop and narrow/dark views.
