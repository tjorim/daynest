# Repository guidance

## UI dependency maintenance

Follow [docs/ui-maintenance.md](docs/ui-maintenance.md) for Base UI/runtime updates and direct dialog maintenance. Run `pnpm ui:check` from `frontend/` after changing shared UI. Dependabot does not update owned component source; preserve the documented customisations and validate interactions and bundle budgets.
