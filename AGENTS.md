# Repository guidance

## UI dependency maintenance

Follow [docs/ui-maintenance.md](docs/ui-maintenance.md) for Base UI/runtime updates and direct dialog maintenance. Run `pnpm ui:check` from `frontend/` after changing shared UI. Dependabot does not update owned component source; preserve the documented customisations and validate interactions and bundle budgets.

Application UI imports use `@/components/ui/<component>`. Direct Base UI subpath imports belong in inventoried UI adapters or exact documented composition exceptions. `pnpm ui:check` enforces the policy; `pnpm ui:test` tests it. Keep styles and application behaviour when aligning imports.
