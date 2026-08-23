## Summary

- 

## Testing

- [ ] Tests added or updated where behavior changed

## Externally callable writes

- [ ] This change adds no externally callable write, **or** I updated [`docs/retry-safety.md`](../docs/retry-safety.md) with its idempotency decision.
- [ ] Retry behavior is covered for every shared REST, MCP, Android, Home Assistant, Pebble, or automation surface.
- [ ] Sequential retry and concurrent-duplicate behavior are tested, or the inventory explicitly says why the operation must not be retried.
- [ ] Authorization and audit attribution remain identical on first execution and retry.
- [ ] Any replay cache documents its retry window and bounded retention, and uses the VPS scheduler (not an in-process scheduler) for production cleanup.
