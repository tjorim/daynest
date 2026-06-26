# Daynest — Code Review & Optimization Plan

> Reviewer pass against the current `main` snapshot. The original
> plan/spec/request inputs were not supplied to this run, so the analysis is
> derived directly from the implemented code and the documented product
> principles in `README.md` and `frontend/docs/tanstack-architecture.md`.

<analysis>
Here is my detailed review of the current codebase.

## 1. Code Organization & Structure

**Overall the project is well-structured.** It is a clean monorepo
(`frontend/`, `backend/`, `android/`, `custom_components/`, `python-daynest/`,
`dashboard/`) with a documented architecture and an explicit layered backend
(`api → services → repositories → models`). The TanStack frontend follows its
own architecture doc faithfully: a canonical `queryKeys` registry, shared
`QueryProvider`/`queryClient`, and per-feature query/action hooks. Separation of
concerns is genuinely good in most places.

The structural problems are concentrated in a few oversized modules that have
become catch-alls:

- **`frontend/src/lib/api/today.ts` (1171 lines)** is misnamed and overloaded.
  Despite the name, it holds types + Zod schemas + the shared HTTP layer
  (`ApiError`, `fetchWithRetry`, `fetchWithAuth`, `parseJsonResponse`) + ~50
  endpoint functions spanning *today, calendar, medication, templates, chores,
  integration clients, user settings, analytics, and search*. Other domains
  already got their own modules (`mealPlans.ts`, `shoppingLists.ts`,
  `recurringGroceries.ts`, `auth.ts`), so this file is an inconsistent leftover.
- **`frontend/src/features/settings/SettingsPage.tsx` (1117 lines)** is a god
  component with 30+ `useState` declarations covering integration clients,
  OAuth sessions, server URL, timezone, notification prefs, calendar feed, and
  PWA install — six unrelated concerns in one render function.
- **Backend `mcp_server.py` (1462)**, `today_service.py` (1337), and
  `today_repository.py` (908)** are large but more defensibly so (one cohesive
  responsibility each); still worth watching for sub-module extraction.

The shared HTTP layer living inside a feature-named file means every other API
module imports low-level primitives from `@/lib/api/today`, coupling unrelated
domains to a "today" module. This is the single highest-leverage structural fix.

## 2. Code Quality & Best Practices

**TypeScript hygiene is excellent**: zero `any`, zero `@ts-ignore`/
`@ts-expect-error`, runtime response validation via Zod, a typed `ApiError`
carrying `status`/`retryable`/`requestId`, exponential-backoff retry scoped to
idempotent methods, and an offline-replay queue. Backend has no TODO/FIXME
debt, only 3 `type: ignore`s, and a real test suite (19 backend test files, 26
frontend test files). i18n is comprehensive (all 20 feature components use
Paraglide messages; 418 keys in both `en` and `nl`). This is a high-quality
codebase, not a rescue job.

Concrete issues found:

1. **Data-loss bug on planned-item updates (high priority).** The backend
   `PlannedItemUpdateRequest` defaults `priority=Priority.normal` and
   `tags=[]` when fields are omitted, and `TodayService.update_planned_item`
   (`today_service.py:685-686`) writes those defaults unconditionally. The
   frontend `buildPlannedItemPayload` and `editPlannedItem`
   (`useTodayActions.ts:28-43`, `180-204`) **omit** `priority`, `tags`, and
   `auto_add_to_list_id`. Result: simply toggling a planned item done/undone or
   editing its title from the Today screen silently resets its priority to
   normal and erases its tags and shopping-list link. This is a correctness
   regression hiding behind a "full PUT with defaulted fields" contract.

2. **Inconsistent response validation.** Most fetchers pass a Zod schema to
   `parseJsonResponse`, but `fetchCalendarDay` (`today.ts:596`) and several
   mutation responses do not, so they silently `as T`-cast unvalidated bodies.
   Validation should be uniform or the un-validated paths documented as
   intentional.

3. **Repeated fetch boilerplate.** ~50 endpoint functions repeat the same
   `fetchWithAuth(url, { headers: { Accept: "application/json" }, signal }, n)`
   → `parseJsonResponse(...)` shape. A small `getJson`/`sendJson` helper would
   remove dozens of lines and make schema-passing the default (addressing #2).

4. **Broad exception handling on the backend.** 14 `except Exception` sites —
   acceptable around I/O boundaries (push, observability) but worth auditing so
   none swallow programming errors silently.

5. **Duplicate type definitions.** `MedicationHistoryItem` is a structural
   copy of `MedicationTodayItem`; the Zod side already aliases
   (`medicationHistoryItemSchema = medicationTodayItemSchema`) but the TS
   interfaces are hand-duplicated.

## 3. UI/UX

**Strong baseline**: PWA installability, offline queue with user-facing "will
be replayed when you reconnect" messaging, online-status hook, request-id
surfaced in error messages for support, confetti on completion, and a search
overlay. Accessibility uses `aria-label`/`role` across 13 feature files, and
inline styles are nearly absent (5 occurrences) — styling is Bootstrap-driven
and consistent.

Gaps:

1. **Accessibility coverage is uneven.** `aria-label` appears in 13 of the
   feature areas but `TodayPage`, `CalendarPage`, `TemplatesPage`, and
   `shopping/ShoppingListDetail` are not among them, despite containing
   icon-only buttons and interactive lists. No skip-link or documented focus
   management for the modals/overlays.
2. **Error display is per-component and ad-hoc.** `SettingsPage` alone tracks
   ~8 separate error-string states (`submitError`, `revokeError`,
   `timezoneError`, `notificationError`, …). There is no shared error/toast
   primitive, so error UX and dismissal behavior vary by screen.
3. **The god `SettingsPage`** is also a UX maintenance risk: six concerns share
   one scroll surface and one component, making per-section loading/disabled
   states inconsistent.

None of these block functionality; they are quality-of-life and
maintainability improvements that preserve current behavior.
</analysis>

# Optimization Plan

Each step is atomic (≤ 20 files), preserves existing behavior unless explicitly
fixing a bug, and keeps the TanStack/query-key and layered-backend conventions.
Steps are ordered so that correctness fixes come first, then structural
refactors, then UI/UX polish.

## Correctness & Data Integrity

- [ ] **Step 1: Stop planned-item updates from wiping `priority`/`tags`/`auto_add_to_list_id`**
  - **Task**: Fix the Today-screen update path so toggling done or editing a
    planned item preserves all server-managed fields. In
    `buildPlannedItemPayload`, include `priority`, `tags`, and
    `auto_add_to_list_id` from the source item. In `editPlannedItem`, carry the
    same three fields through from `item` when the caller does not override
    them. Add a regression test asserting that `togglePlannedItem` on an item
    with `priority: "high"` and non-empty `tags` sends those values unchanged.
  - **Files**:
    - `frontend/src/features/today/useTodayActions.ts`: extend
      `buildPlannedItemPayload` and `editPlannedItem` payloads.
    - `frontend/tests/features/today/useTodayActions.test.ts`: add
      preservation regression test.
  - **Step Dependencies**: None
  - **User Instructions**: None
  - **Success Criteria**: Toggling/editing a planned item from Today no longer
    resets its priority or clears its tags/list link; new test passes.

- [ ] **Step 2: Make response validation uniform**
  - **Task**: Pass the appropriate Zod schema to every `parseJsonResponse` call
    that currently omits one (start with `fetchCalendarDay`, then audit the
    medication/template/chore mutation fetchers). Where an unvalidated cast is
    intentional (e.g. `204 No Content`), add a one-line comment so the omission
    is explicit rather than accidental.
  - **Files**:
    - `frontend/src/lib/api/today.ts`: add `CalendarDayResponseSchema` and apply
      it; thread schemas through remaining un-validated fetchers.
    - `frontend/tests/lib/api/today.contract.test.ts`: assert calendar-day
      validation rejects a malformed payload.
  - **Step Dependencies**: None
  - **Success Criteria**: No fetcher returns an unvalidated `as T` cast without
    an explicit justification comment; contract test covers the new schema.

## Code Structure & Organization

- [ ] **Step 3: Extract the shared HTTP layer out of `today.ts`**
  - **Task**: Move `ApiError`, `isRetryableStatus`, `sleep`, `fetchWithRetry`,
    `withAuthHeader`, `fetchWithAuth`, `parseJsonResponse`, and
    `isRetryableApiError` into a new `frontend/src/lib/api/http.ts`. Re-export
    them from `today.ts` to avoid a churn-heavy import rewrite in this step.
  - **Files**:
    - `frontend/src/lib/api/http.ts`: new home for the HTTP primitives.
    - `frontend/src/lib/api/today.ts`: import-and-re-export from `http.ts`.
    - `frontend/tests/lib/api/today.fetch.test.ts`: update import path if it
      reaches in directly (behavior unchanged).
  - **Step Dependencies**: Step 2 (so schema-passing is settled before the move)
  - **Success Criteria**: `pnpm test` and `pnpm build` green; no behavior change;
    HTTP primitives live in `http.ts`.

- [ ] **Step 4: Add `getJson`/`sendJson` helpers and adopt them**
  - **Task**: In `http.ts`, add thin helpers that combine `fetchWithAuth` +
    `parseJsonResponse` with a schema argument (e.g.
    `getJson<T>(path, schema, signal, retries)` and
    `sendJson<T>(method, path, body, schema)`). Refactor a first batch of
    endpoint functions in `today.ts` to use them. This removes repeated headers/
    retry/parse boilerplate and makes schema-passing the default path.
  - **Files**:
    - `frontend/src/lib/api/http.ts`: add helpers.
    - `frontend/src/lib/api/today.ts`: migrate the today/calendar/medication
      fetchers to the helpers (leave others for Step 5).
  - **Step Dependencies**: Step 3
  - **Success Criteria**: Migrated functions are shorter, still type-safe, tests
    green.

- [ ] **Step 5: Split domain APIs out of `today.ts`**
  - **Task**: Move integration-client, user-settings, analytics, and search
    endpoint groups into `lib/api/integrationClients.ts`, `lib/api/settings.ts`,
    `lib/api/analytics.ts`, `lib/api/search.ts` (templates/chores can move to
    `lib/api/templates.ts`). Update importers to point at the new modules.
    `today.ts` should end up holding only today/calendar/planned-item concerns.
  - **Files** (≤ ~15): new `lib/api/*.ts` modules + their importing feature
    hooks (`useSettingsQueries.ts`, `useStatsQuery.ts`, `useSearchQuery.ts`,
    `useTemplateQueries.ts`) and matching test imports.
  - **Step Dependencies**: Step 4
  - **Success Criteria**: `today.ts` < ~500 lines and domain-focused; all
    imports resolve; tests/build green.

- [ ] **Step 6: De-duplicate medication history types**
  - **Task**: Replace the hand-duplicated `MedicationHistoryItem` interface with
    `export type MedicationHistoryItem = MedicationTodayItem;` mirroring the Zod
    aliasing already in place.
  - **Files**:
    - `frontend/src/lib/api/today.ts` (or the medication module if Step 5 moved
      it): collapse the duplicate type.
  - **Step Dependencies**: Step 5 (to land in the right module)
  - **Success Criteria**: Single source of truth; no type errors.

## Component Decomposition

- [ ] **Step 7: Split `SettingsPage` into section components**
  - **Task**: Extract self-contained sections — `IntegrationClientsSection`,
    `OAuthSessionsSection`, `ServerConfigSection`, `TimezoneSection`,
    `NotificationPrefsSection`, `CalendarFeedSection` — each owning its own
    local state and existing query/mutation hooks. `SettingsPage` becomes a thin
    layout that composes them. Keep all current behavior, labels, and tests
    passing (adjust test selectors only if the DOM structure is unavoidably
    changed).
  - **Files** (≤ ~10): new `features/settings/sections/*.tsx`, slimmed
    `SettingsPage.tsx`, and the two existing settings test files updated as
    needed.
  - **Step Dependencies**: Step 5 (settings API module split)
  - **Success Criteria**: `SettingsPage.tsx` is a composition shell; each
    section is independently testable; existing settings tests pass.

## UI/UX & Accessibility

- [ ] **Step 8: Introduce a shared error/feedback primitive**
  - **Task**: Add a small `FeedbackBanner`/`useFeedback` primitive (Bootstrap
    alert styling, dismissible, polite `role="status"`/`aria-live`) and adopt it
    in one screen first (e.g. the Step-7 settings sections) to replace ad-hoc
    per-field error strings. Document it for reuse.
  - **Files**:
    - `frontend/src/components/common/FeedbackBanner.tsx`: new component.
    - One or two settings sections from Step 7: adopt it.
    - `frontend/tests/...`: a focused test for the primitive.
  - **Step Dependencies**: Step 7
  - **Success Criteria**: Errors/successes announced via `aria-live`; consistent
    dismissal UX in the adopting screen.

- [ ] **Step 9: Close accessibility gaps on core screens**
  - **Task**: Add `aria-label`s to icon-only buttons and meaningful `role`/
    labelling on interactive lists in `TodayPage`, `CalendarPage`,
    `TemplatesPage`, and `shopping/ShoppingListDetail`. Add a skip-to-content
    link in `AppLayout` and ensure modals/overlays move focus on open and
    restore on close.
  - **Files** (≤ 6): the four feature files above + `app/layout/AppLayout.tsx`
    + (optionally) the search overlay for focus restoration.
  - **Step Dependencies**: None (can run in parallel with structural steps)
  - **Success Criteria**: All icon-only controls on these screens have
    accessible names; keyboard users can skip nav; focus is trapped/restored in
    overlays.

## Backend Hardening (optional, lower priority)

- [ ] **Step 10: Audit broad `except Exception` sites**
  - **Task**: Review the 14 `except Exception` handlers; narrow to specific
    exception types where the failure mode is known, and ensure each logs with
    enough context (`request_id`) rather than swallowing. Leave genuinely
    defensive boundaries (push delivery, observability) but comment why.
  - **Files** (≤ ~8): the service/route files containing the broad handlers
    (e.g. `services/push_service.py`, `core/observability.py`, integration
    routes).
  - **Step Dependencies**: None
  - **Success Criteria**: No handler silently discards an unexpected error;
    backend tests stay green.

## Logical Next Step

After Step 9, the highest-value follow-up is to **add a lightweight CI
accessibility check** (e.g. an `axe`/Playwright pass over the main routes in the
existing `e2e/` setup) so the Step 8–9 gains do not regress, and to extend the
`getJson`/`sendJson` adoption (Step 4) across the newly-split API modules from
Step 5 for full consistency.
