# UI registry coverage audit (#1137)

Source review: 2026-10-24, default-branch commit
`85edb44886e7928b763417e3c6c353ecda425026` (also this checkout's baseline;
confirmed against `origin` with `git ls-remote`). The older issue descriptions
are historical: Bootstrap is removed, `components.json` exists, and there are
17 locally owned component entries. None is generated registry source.

## Decision and ownership

Keep `base-nova`, Lucide, semantic tokens, Paraglide translations and existing
native form/event APIs. `components.json` configures the shadcn Base UI preset;
`ui-maintenance.json` deliberately uses direct `base-ui` mode. Installing a CLI
or copying every registry component would not establish adoption coverage.
The decisions below compare current source with supported component patterns;
they do not claim a byte-for-byte review of generated registry output.

Owners: [#934](https://github.com/tjorim/daynest/issues/934) tooling and registry;
[#935](https://github.com/tjorim/daynest/issues/935) tokens/contrast;
[#936](https://github.com/tjorim/daynest/issues/936) dialog behavior;
[#937](https://github.com/tjorim/daynest/issues/937) feature/shared implementations;
[#938](https://github.com/tjorim/daynest/issues/938) removal validation.
[#1137](https://github.com/tjorim/daynest/issues/1137) owns this inventory and the
completion gate for [#933](https://github.com/tjorim/daynest/issues/933).

All shared source paths below are relative to `frontend/src/components/ui/`;
consumer paths in the appendix are relative to `frontend/`.

| Category / source | Registry/docs alternative | Decision and requirement | Owner |
| --- | --- | --- | --- |
| `button.tsx` (Button, buttonVariants, ButtonGroup) | Button, Button Group | Keep Base UI Button and existing semantic/outline/link variants, default/sm sizes; router links need classes without nested buttons. Group supplies layout only. | #937 |
| `alert.tsx`, `badge.tsx` | Alert, Badge | Keep static translated feedback/status containers and semantic tones; consumers must choose live-region roles. | #937 |
| `card.tsx` | Card | Keep slots and feature grid sizing; no behavior primitive needed. | #937 |
| `input.tsx` (Input, Textarea), `field.tsx` | Input, Textarea, Field | Keep native date/time/number constraints and TanStack Form callbacks. Field is layout, not automatic validation/label wiring. Consumer owns IDs, labels and error descriptions. | #937 |
| `select.tsx` | Native Select; Base UI Select | Keep native single selection, option children, mobile picker and `event.target.value`; no popup customization requirement. Do not replace native APIs solely for styling. | #937 |
| `checkbox.tsx`, `radio.tsx`, `switch.tsx` | Checkbox/Group, Radio Group, Switch | Keep native checked/change and label/form semantics; native radio grouping handles arrow keys. Bulk selection remains independent checkboxes. Switch is a binary checkbox, not the three-state theme selector. | #937 |
| `list-group.tsx` | Item; useRender; Combobox for actual selection | Keep flush/active presentation and useRender for real buttons/links/list items. Active styling alone does not implement a listbox or expose a selection. | #937 |
| `dialog.tsx`, `dialog.css` | Dialog | Keep owned Base UI adapter for calendar event, meal slot/generation, medication and search. Review all consumers together for API changes. | #936 |
| `EditorDialog.tsx` | Dialog / Alert Dialog | Keep guarded composition for TemplateEditor. Dirty/pending guards, nested discard confirmation and explicit focus return are requirements beyond a bare generated popup. | #936 |
| `close-button.tsx` | Button with icon | Keep shared close affordance and translated accessible name. | #936/#937 |
| `table.tsx` | Table / Data Table | Keep native table slots, compact cells and horizontal overflow; IntegrationClientsSection retains TanStack sorting, filtering and column visibility. No pagination UI currently exists; do not install unused Pagination. | #937 |
| `progress.tsx` | Progress | Keep determinate percentage rendering with progressbar values; Today consumer owns name/value. | #937 |
| `spinner.tsx` | Spinner / Skeleton | Keep existing text/loading feedback. No skeleton implementation exists to replace; add Skeleton only for an actual content-placeholder requirement. | #937 |

## Application compositions beyond the shared directory

| Source under `frontend/src/` | Decision / acceptance | Owner |
| --- | --- | --- |
| `app/layout/AppLayout.tsx` | Keep router links and responsive disclosure navigation rather than a menu widget: routes are links, mobile toggle is a button. Check expanded state, current route, keyboard access and mobile close-on-navigation. Keep the three-state theme action as a labelled button. | #937/#935 |
| `features/shopping/ShoppingListsPage.tsx` | **Extend/replace before completion:** current `role="tablist"` contains ordinary buttons with no tab roles, selected state, panels or roving focus. Choose Base UI Tabs for actual panels, or a labelled group of pressed filter buttons for this status filter. Preserve active/archived filtering and translated labels. | #937 |
| `features/search/SearchOverlay.tsx` | **Extend/replace before completion:** custom ArrowUp/Down index highlights a result without exposing active selection to assistive technology; input has only a placeholder. Compare Command/Combobox/Autocomplete for grouped asynchronous navigation results. Preserve debounce, minimum query length, loading/error/empty feedback, route destinations, Escape and focus return. Add an explicit input label and accessible keyboard-result relationship; cover stale/empty results. | #937/#936 |
| `features/today/TodaySections.tsx`, `features/shopping/ShoppingListDetail.tsx`, `features/settings/sections/IntegrationClientsSection.tsx` | Keep independent/bulk/column-visibility checkboxes, not a multi-select popup. Check labels, select-all behavior and disabled pending controls. | #937 |
| `features/templates/TemplateEditor.tsx`, `features/meal-planning/MealSlotModal.tsx`, `features/today/QuickAddPlannedForm.tsx` | Keep TanStack Form and native fields. Check shared slots with required/invalid/error descriptions and submitted payloads, not just appearance. | #937 |
| `features/calendar/CalendarPage.tsx`, `CalendarPageSections.tsx` | Keep Schedule-X as specialized renderer; separately check surrounding date/filter/editor controls. The raw input in CalendarPageSections is a file-upload control, not a missed text Input migration. | #937/#935 |
| `features/stats/StatsPage.tsx` | Keep TanStack charts; audit surrounding date/range controls and loading/empty/error messages separately. | #937 |
| `components/common/FeedbackBanner.tsx`, `app/router/lazyPage.tsx`, all feature pages | Keep translated Alert/Spinner/text empty states instead of introducing Empty/Skeleton for uniformity alone. FeedbackBanner explicitly supplies alert/status roles. Review feature-specific live feedback and retry controls with consumers. | #937 |

## Completion gate and evidence

This is a source adoption inventory, **not a completed interaction/visual audit**.
The two explicit feature gaps above prevent final coverage sign-off. Implement
those under #937; this issue does not silently broaden into those migrations.
No runtime, styling, translations or dependencies change in this audit.

Existing evidence: [Bootstrap removal validation](bootstrap-removal-validation.md)
records the earlier 210 unit tests, 54 permanent Playwright cases, dialog/axe
checks and 1280/390 light/dark screenshots for Today, Settings, Calendar and Meal
Plan. These are historical results, not new runs or comprehensive coverage of
Shopping/Search. The 375px editor evidence in ui-maintenance is also historical.

Before #933/#937 completion, attach/link fresh evidence for:

- Shopping and Search fixes: keyboard navigation, selected state, explicit labels,
  async results and hover/selected contrast, with Playwright/axe regression cases.
- All affected consumers: light/dark at 1280px and 390px, both locales, screenshots
  against the main baseline, no horizontal overflow, labels and error associations.
- Dialogs: Tab/Shift+Tab, Escape/outside dismissal, pending/dirty guards, nested
  discard cancel/confirm, initial and returned focus across all dialog consumers.
- `pnpm ui:check`, `pnpm ui:test`, lint, format, unit tests, production/mock builds
  and existing Playwright suite; preserve bundle budgets.

Current audit validation (Node 24.14.0, project pnpm 10.33.0):
`pnpm ui:check`, `pnpm ui:test` (22/22), `pnpm format:check` and
`pnpm lint` pass; lint retains existing locale-tooling/live-update-test warnings.
`git diff --check` passes. No new browser, screenshot, build or runtime-test
results are claimed for this documentation/metadata change.

The #933/#937 issue bodies already link #1137 as their coverage gate. Once this
audit is merged, add its durable source link to those bodies and #1137; leave
final interaction/visual acceptance open until the evidence above exists.

Keep the review fields in the machine inventory unset until the corresponding
compatibility review has evidence. A source keep decision is not visual approval.

## Official comparison sources

Reviewed 2026-10-24:
[shadcn component catalog](https://ui.shadcn.com/docs/components),
[Base UI Native Select recipe](https://ui.shadcn.com/docs/components/base/native-select),
[Base UI Select](https://base-ui.com/react/components/select),
[Dialog](https://base-ui.com/react/components/dialog),
[Tabs](https://base-ui.com/react/components/tabs) and
[Combobox](https://base-ui.com/react/components/combobox).
The catalog includes native controls and static recipes as well as behavior
primitives. Generate only a selected implementation through #934's configuration,
then own its tokens/variants and review every consumer through #937.

## Consumer coverage snapshot

This appendix enumerates production imports for every shared module at the
reviewed revision, including shared-to-shared composition. Tests/generated code
are excluded. Regenerate/recheck alongside `pnpm ui:usage` when moving controls.

- **EditorDialog**: `src/features/templates/TemplateEditor.tsx`

- **alert**: `src/app/layout/AppLayout.tsx`, `src/app/router/AppRouter.tsx`, `src/app/router/lazyPage.tsx`, `src/components/common/FeedbackBanner.tsx`, `src/features/auth/AuthPage.tsx`, `src/features/calendar/CalendarPage.tsx`, `src/features/meal-planning/GenerateShoppingListModal.tsx`, `src/features/meal-planning/MealPlannerPage.tsx`, `src/features/meal-planning/MealSlotModal.tsx`, `src/features/medication/MedicationPage.tsx`, `src/features/pebble/PebblePairPage.tsx`, `src/features/search/SearchOverlay.tsx`, `src/features/settings/sections/AccountDeletionSection.tsx`, `src/features/settings/sections/IntegrationClientsSection.tsx`, `src/features/shopping/AddItemForm.tsx`, `src/features/shopping/RecurringGroceriesPage.tsx`, `src/features/shopping/ShoppingListDetail.tsx`, `src/features/shopping/ShoppingListsPage.tsx`, `src/features/stats/StatsPage.tsx`, `src/features/templates/TemplatesPage.tsx`, `src/features/today/TodayPage.tsx`

- **badge**: `src/features/calendar/CalendarEventModal.tsx`, `src/features/medication/MedicationPage.tsx`, `src/features/search/SearchOverlay.tsx`, `src/features/settings/sections/IntegrationClientsSection.tsx`, `src/features/settings/sections/OAuthSessionsSection.tsx`, `src/features/shopping/RecurringGroceriesPage.tsx`, `src/features/shopping/ShoppingListDetail.tsx`, `src/features/shopping/ShoppingListsPage.tsx`, `src/features/stats/StatsPage.tsx`, `src/features/templates/TemplatesPage.tsx`, `src/features/today/TodaySections.tsx`

- **button**: `src/app/layout/AppLayout.tsx`, `src/app/router/lazyPage.tsx`, `src/components/common/FeedbackBanner.tsx`, `src/components/ui/EditorDialog.tsx`, `src/features/auth/AuthPage.tsx`, `src/features/calendar/CalendarEventModal.tsx`, `src/features/calendar/CalendarPage.tsx`, `src/features/calendar/CalendarPageSections.tsx`, `src/features/meal-planning/GenerateShoppingListModal.tsx`, `src/features/meal-planning/MealPlannerPage.tsx`, `src/features/meal-planning/MealSlotCard.tsx`, `src/features/meal-planning/MealSlotModal.tsx`, `src/features/medication/MedicationPage.tsx`, `src/features/pebble/PebblePairPage.tsx`, `src/features/search/SearchOverlay.tsx`, `src/features/settings/sections/AccountDeletionSection.tsx`, `src/features/settings/sections/IntegrationClientsSection.tsx`, `src/features/settings/sections/OAuthSessionsSection.tsx`, `src/features/settings/sections/PwaInstallButton.tsx`, `src/features/settings/sections/ServerConfigSection.tsx`, `src/features/settings/sections/UserPreferencesSection.tsx`, `src/features/shopping/AddItemForm.tsx`, `src/features/shopping/RecurringGroceriesPage.tsx`, `src/features/shopping/ShoppingListDetail.tsx`, `src/features/shopping/ShoppingListsPage.tsx`, `src/features/stats/StatsPage.tsx`, `src/features/templates/TemplateEditor.tsx`, `src/features/templates/TemplatesPage.tsx`, `src/features/today/PlannedSection.tsx`, `src/features/today/QuickAddPlannedForm.tsx`, `src/features/today/TodayPage.tsx`, `src/features/today/TodaySections.tsx`

- **card**: `src/features/auth/AuthPage.tsx`, `src/features/calendar/CalendarPage.tsx`, `src/features/calendar/CalendarPageSections.tsx`, `src/features/meal-planning/MealPlannerPage.tsx`, `src/features/medication/MedicationPage.tsx`, `src/features/search/SearchOverlay.tsx`, `src/features/settings/sections/AccountDeletionSection.tsx`, `src/features/settings/sections/IntegrationClientsSection.tsx`, `src/features/settings/sections/OAuthSessionsSection.tsx`, `src/features/settings/sections/ServerConfigSection.tsx`, `src/features/settings/sections/UserPreferencesSection.tsx`, `src/features/shopping/AddItemForm.tsx`, `src/features/shopping/RecurringGroceriesPage.tsx`, `src/features/shopping/ShoppingListDetail.tsx`, `src/features/shopping/ShoppingListsPage.tsx`, `src/features/stats/StatsPage.tsx`, `src/features/templates/TemplatesPage.tsx`, `src/features/today/TodaySections.tsx`

- **checkbox**: `src/features/calendar/CalendarPageSections.tsx`, `src/features/medication/MedicationPage.tsx`, `src/features/settings/sections/IntegrationClientsSection.tsx`, `src/features/shopping/RecurringGroceriesPage.tsx`, `src/features/templates/TemplateEditor.tsx`, `src/features/today/TodaySections.tsx`

- **close-button**: `src/components/ui/EditorDialog.tsx`, `src/components/ui/dialog.tsx`

- **dialog**: `src/features/calendar/CalendarEventModal.tsx`, `src/features/meal-planning/GenerateShoppingListModal.tsx`, `src/features/meal-planning/MealSlotModal.tsx`, `src/features/medication/MedicationPage.tsx`, `src/features/search/SearchOverlay.tsx`

- **field**: `src/features/calendar/CalendarPageSections.tsx`, `src/features/meal-planning/MealPlannerPage.tsx`, `src/features/meal-planning/MealSlotModal.tsx`, `src/features/medication/MedicationPage.tsx`, `src/features/settings/sections/AccountDeletionSection.tsx`, `src/features/settings/sections/IntegrationClientsSection.tsx`, `src/features/settings/sections/ServerConfigSection.tsx`, `src/features/settings/sections/UserPreferencesSection.tsx`, `src/features/shopping/AddItemForm.tsx`, `src/features/shopping/RecurringGroceriesPage.tsx`, `src/features/shopping/ShoppingListsPage.tsx`, `src/features/templates/TemplateEditor.tsx`

- **input**: `src/components/ui/select.tsx`, `src/features/calendar/CalendarPageSections.tsx`, `src/features/meal-planning/MealPlannerPage.tsx`, `src/features/meal-planning/MealSlotModal.tsx`, `src/features/medication/MedicationPage.tsx`, `src/features/search/SearchOverlay.tsx`, `src/features/settings/sections/AccountDeletionSection.tsx`, `src/features/settings/sections/IntegrationClientsSection.tsx`, `src/features/settings/sections/ServerConfigSection.tsx`, `src/features/settings/sections/UserPreferencesSection.tsx`, `src/features/shopping/AddItemForm.tsx`, `src/features/shopping/RecurringGroceriesPage.tsx`, `src/features/shopping/ShoppingListsPage.tsx`, `src/features/templates/TemplateEditor.tsx`, `src/features/today/QuickAddPlannedForm.tsx`, `src/features/today/TodaySections.tsx`

- **list-group**: `src/features/calendar/CalendarPageSections.tsx`, `src/features/meal-planning/GenerateShoppingListModal.tsx`, `src/features/medication/MedicationPage.tsx`, `src/features/search/SearchOverlay.tsx`, `src/features/settings/sections/OAuthSessionsSection.tsx`, `src/features/shopping/ShoppingListDetail.tsx`, `src/features/stats/StatsPage.tsx`, `src/features/templates/TemplatesPage.tsx`, `src/features/today/TodaySections.tsx`

- **progress**: `src/features/today/TodaySections.tsx`

- **radio**: `src/features/settings/sections/ServerConfigSection.tsx`

- **select**: `src/features/calendar/CalendarPageSections.tsx`, `src/features/meal-planning/MealPlannerPage.tsx`, `src/features/settings/sections/IntegrationClientsSection.tsx`, `src/features/settings/sections/UserPreferencesSection.tsx`, `src/features/shopping/RecurringGroceriesPage.tsx`, `src/features/today/TodaySections.tsx`

- **spinner**: `src/features/auth/AuthPage.tsx`, `src/features/pebble/PebblePairPage.tsx`, `src/features/search/SearchOverlay.tsx`, `src/features/templates/TemplatesPage.tsx`, `src/features/today/TodayPage.tsx`

- **switch**: `src/features/settings/sections/UserPreferencesSection.tsx`

- **table**: `src/features/settings/sections/IntegrationClientsSection.tsx`
