# TanStack architecture (frontend)

This document defines how Daynest uses TanStack packages across server state, routing, forms, and dense tables.

## Adoption stages

The staged rollout of the TanStack suite is now fully complete.

Completed implementation phases:

1. `#356` Query foundation
2. `#357` Router migration
3. `#358` Domain query migration
4. `#355` Form/Table adoption

Current repository status:

- ✅ TanStack Query is the default server-state layer.
- ✅ TanStack Router is the default route/auth/search-param layer.
- ✅ TanStack Form is used for the medication plan editing flow.
- ✅ TanStack Table is used for integration client management in Settings.

## Query architecture

- Shared provider: `src/app/providers/QueryProvider.tsx`
- Shared client defaults (retry/refetch policy): `src/lib/query/queryClient.ts`
- Canonical query key registry: `src/lib/query/queryKeys.ts`

Server-backed feature hooks:

- Today: `src/features/today/useTodayQuery.ts`, `src/features/today/useTodayActions.ts`
- Calendar + planned items: `src/features/calendar/useCalendarQueries.ts`, `src/features/calendar/useCalendarPlannedItems.ts`
- Medication: `src/features/medication/useMedicationQueries.ts`
- Templates/routines/chores: `src/features/templates/useTemplateQueries.ts`
- Settings/integration clients: `src/features/settings/useSettingsQueries.ts`
- Search: `src/features/search/useSearchQuery.ts`
- Stats/analytics: `src/features/stats/useStatsQuery.ts`

### Mutation + invalidation rules

- Mutations must invalidate by query-key family from `queryKeys` (never ad-hoc string keys).
- Cross-domain mutations should invalidate related domains when read models overlap.
  - Examples:
    - Today actions invalidate `today`, `calendar`, and `plannedItems` families as needed.
    - Template and medication mutations invalidate `today`, `calendar`, `search`, and `analytics` families.
- Prefer shared invalidation helpers inside domain hook files (for example, a custom hook returning an invalidation callback like `useInvalidateCalendarQueries`, or a plain function accepting `queryClient`) to ensure safe execution inside mutation callbacks without violating the Rules of Hooks.

## Router architecture

- Router definition + auth guards: `src/app/router/AppRouter.tsx`
- App wiring: `src/main.tsx` with `RouterProvider`
- Typed search params are validated in-route (for example auth `from`, calendar `date`/`month`).

### Router test helpers

- Use `tests/utils/router.tsx` (`renderWithRouter`) to render routes with auth context.
- Use `tests/utils/queryTestProvider.tsx` for isolated React Query tests.

## Form and table usage guidelines

- TanStack Form: use for multi-field workflows where validation and reset state become complex (current anchor example: `src/features/medication/MedicationPage.tsx`).
- TanStack Table: use for dense management views needing sorting/filtering/column visibility (current anchor example: integration clients table in `src/features/settings/SettingsPage.tsx`).

