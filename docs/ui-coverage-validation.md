# Registry coverage completion evidence (#1137)

PR: [#1200](https://github.com/tjorim/daynest/pull/1200).
Source baseline: default-branch commit `85edb44886e7928b763417e3c6c353ecda425026`.
Node 24.14.0, pnpm 10.33.0, Base UI 1.9.0; frozen lockfile, no dependency changes.
See [the adoption inventory](ui-registry-coverage.md) for decisions and consumers.

## Selected implementation and requirements

- Shopping's active/archived control is a labelled group of native pressed buttons.
  It filters one collection, so a tab/panel widget is unnecessary.
- Search labels its input explicitly and moves actual focus to result buttons for
  ArrowDown/Up, Home/End. Native Enter/Space invokes the result action. Returning
  upward restores input focus; Escape/backdrop dismissal returns to the trigger.
  Changed/short queries hide stale results while the debounced request catches up.
- Search active details use opaque white: the previous translucent text failed axe
  at 3.44:1 on the blue active row. The new foreground passes the same check.
- Shared outline buttons use semantic text tokens;
  dark mode overrides primary, secondary, danger and success text and links. The light button surface follows the theme so meal-card detail text stays legible. Filled/hover backgrounds keep their semantic colors.
  Dark shopping links and destructive actions previously failed around 3.4:1.
  This shared improvement applies to buttonVariants consumers as well as Button.
- Medication creation date/time/interval labels now point to their native inputs.
  Statistics info/warning values and the account-deletion heading use readable
  emphasis tokens. These fixes cover the surrounding content of specialized renderers.
- EditorDialog's pending-save guards are unchanged and now have a regression test
  for Escape, outside press and disabled close/cancel, plus dismissal after saving.
  Existing Playwright cases cover dirty drafts, nested confirmation and focus return.

## Verification

- `pnpm ui:check`, `pnpm ui:test`: valid 17-component inventory, import policy and
  22 tooling tests.
- `pnpm locale:audit`: 99 production files, matching English/Dutch catalogues.
- `pnpm lint`, `pnpm format:check`, `git diff --check`: pass; existing unrelated
  locale-tooling/live-update-test warnings remain.
- Unit tests: 38 files, 211 tests (including the new pending-save guard test).
- Production and MSW mock builds pass, including TypeScript. The production build
  uses a fresh separate output directory so browser verification continues against MSW.
- Final Playwright run: 95 passed (87 permanent cases plus 8 temporary baseline/
  current capture cases, removed after verification).
- Browser coverage includes 32 route/viewport/theme axe cases that navigate through
  the app and assert actual content before scanning. This prevents a route-load
  error screen from being mistaken for a successful page audit. The 8 new
  Shopping/Search cases cover English/Dutch, light/dark and 1280/390px, populated
  results, actual focus, first/last navigation, changed queries, minimum length,
  no results, Enter navigation, pressed state, Escape/focus return and axe with
  hovered/active states. Existing dialog tests cover Tab/Shift+Tab, backdrop
  dismissal, dirty drafts, nested confirmation, focus return and theme changes.

## Explicit renderer exception

Schedule-X remains a specialized renderer, as required by #1137. The axe route
cases exclude only `[data-slot=daynest-calendar] .sx__calendar-wrapper`; all
calendar controls outside that vendor subtree remain included and pass in both
sizes/themes. This is not a claim that the complete vendor calendar passes axe.

Raw scans on the immutable main baseline and current build reproduce these
vendor findings at 1280px: `aria-prohibited-attr` (8 date-grid nodes),
`scrollable-region-focusable` (1 view container), and in dark mode a hidden-label
finding (1 date input) and contrast findings (20 vendor weekday/date/hour nodes).
Current scans removed the two additional surrounding-button contrast nodes found
on the dark baseline. Mobile scans reproduce the same vendor categories with
fewer visible date columns. Keep this exception with the #935/#937 calendar
ownership; a vendor accessibility change needs its own runtime/API review under
ui-maintenance.md rather than rewriting the calendar during registry adoption.

## Production bundle comparison

Same source baseline and dependencies, `pnpm build --outDir <separate-directory>`.
Totals cover every asset; gzip compresses each file separately with Python defaults.

| Asset      | Baseline raw bytes | Current raw bytes | Baseline gzip bytes | Current gzip bytes |
| ---------- | -----------------: | ----------------: | ------------------: | -----------------: |
| JavaScript |          1,528,608 |         1,529,406 |             458,995 |            459,145 |
| CSS        |             67,845 |            67,669 |              14,060 |             14,052 |

No bundle thresholds or dependencies changed. This checkout has no separate
frontend size-budget script; comparison is reported rather than inventing one.

## Visual evidence

Baseline and current MSW builds run separately on ports 4174 and 4173. Capture
Today, Calendar, Templates, Settings, Medication, Meal Plan, Shopping and Stats,
plus populated Search, in light/dark at 1280×900 and 390×900. Assert the calendar
wrapper or page heading before each screenshot and check document overflow.
The permanent coverage cases attach additional English/Dutch screenshots.

Captured 72 full-page/view PNGs across the two builds and visually compared the
pairs. The committed comparisons put baseline on the left and current on the
right; consumer sheets show the first viewport for legibility. Layouts and
breakpoints remain stable; intended differences are readable theme colors and
Search focus/detail text. All captures assert no horizontal document overflow.

| Theme / width  | Shopping                                                | Populated Search                                      | Shared consumers                                         |
| -------------- | ------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------- |
| light / 1280px | [Compare](ui-coverage-evidence/shopping-light-1280.png) | [Compare](ui-coverage-evidence/search-light-1280.png) | [Compare](ui-coverage-evidence/consumers-light-1280.png) |
| light / 390px  | [Compare](ui-coverage-evidence/shopping-light-390.png)  | [Compare](ui-coverage-evidence/search-light-390.png)  | [Compare](ui-coverage-evidence/consumers-light-390.png)  |
| dark / 1280px  | [Compare](ui-coverage-evidence/shopping-dark-1280.png)  | [Compare](ui-coverage-evidence/search-dark-1280.png)  | [Compare](ui-coverage-evidence/consumers-dark-1280.png)  |
| dark / 390px   | [Compare](ui-coverage-evidence/shopping-dark-390.png)   | [Compare](ui-coverage-evidence/search-dark-390.png)   | [Compare](ui-coverage-evidence/consumers-dark-390.png)   |
