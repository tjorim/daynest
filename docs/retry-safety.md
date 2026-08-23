# Retry safety and idempotency

Externally callable writes must have defined behavior when a client repeats a request after a timeout, process restart, or reconnect. This document is the inventory and contract for Daynest's REST, MCP, Android, Home Assistant, Pebble, and browser automation paths.

## Strategy vocabulary

| Strategy | Contract |
| --- | --- |
| Resource-state | Repeating a `PUT`, `PATCH`, or status transition sets the same final state. |
| Delete-to-absent | The resource is absent after the first successful delete. A retry may return `404`; callers treat that as success. |
| Natural-key upsert | A database uniqueness constraint identifies the logical record and create-or-update returns that record. |
| Optimistic concurrency | The caller must re-read after `409`; the server never silently overwrites a conflicting transition. |
| Client-generated ID | The caller supplies a stable logical operation ID on every attempt. |
| Replay token required | A server-side record must return the original result for the same authenticated principal, operation, token, and payload. |
| At-most-once client guard | The client prevents duplicate submission, but cannot resolve a lost server response by itself. |

`GET` operations that materialize recurrence instances are also included: they write internally, but unique recurrence/date keys make repeated materialization a natural-key upsert.

## Inventory

### Naturally retry-safe writes

| Domain and REST operation | Other callers | Strategy and retry result |
| --- | --- | --- |
| Task instance start, complete, skip | MCP routine tools, Android notification actions, REST bulk | Resource-state. Repeating the same transition preserves the state. A competing *different* terminal transition returns `409`; re-read before deciding what to do. |
| Chore instance assign, complete, skip, reschedule | MCP routine tools, Home Assistant and Pebble actions, Android notification actions, REST bulk | Resource-state. Mutations lock the instance row; exact complete, skip, and reschedule replays are no-ops, while competing terminal transitions return `409`. Assignment sets an absolute assignee. |
| Medication dose take, skip, miss; skip missed doses | MCP medication tools, Home Assistant actions, Android | Resource-state. Same transition is safe; a different terminal state is a `409` conflict. Bulk skip is bounded to the selected missed set. |
| Planned item update, done | MCP planning tools, Home Assistant actions, Android/browser | Resource-state. **Defer/snooze is relative and must not be automatically retried after an uncertain response**; re-read the item first. |
| Routine, chore, medication, meal-plan, meal-slot, shopping-list and household update | MCP tools where exposed, Android/browser | Resource-state (`PUT`). Concurrent last-writer-wins updates are currently accepted; clients re-read after an uncertain result. |
| User profile/settings update; push subscribe | Android/browser | Resource-state; push subscription is a natural-key upsert. |
| Calendar token revoke, session revoke, integration-client revoke, and resource deletes | MCP tools where exposed, integrations UI | Delete-to-absent. A retry can receive `404`/`204`; clients treat both as an absent final state. Token regeneration/rotation is deliberately excluded because it creates a new secret. |
| Recurrence materialization during today/calendar/list reads | REST, MCP, Home Assistant | Natural-key upsert using template/series plus scheduled date. Concurrent duplicate insertion is constrained by the database. |
| Household invite | REST/browser | Natural key `(household, user)`. A repeat returns `409` rather than creating another membership. |
| Import recurring groceries into a shopping list | REST/browser | Natural-key upsert through the planned item's linked shopping-list reference. A retry returns the same imported items. |
| Bulk complete/skip/done | REST/browser offline queue | Each item is a resource-state transition. Results remain per-item and the batch commits successful items once; retrying reconciles each item independently. |

For every shared operation, the service layer is authoritative. REST, MCP, and integration adapters must call the same service method so authorization, conflict behavior, event emission, and audit actor attribution do not diverge.

### Retry-sensitive creates and side effects

| Operation | Current guarantee | Required caller behavior / future strategy |
| --- | --- | --- |
| Create planned item (including recurrence series), routine, chore, medication plan, meal plan, shopping list, or household | No replay identity; two accepted requests create two resources. | Do not automatically retry an uncertain response. Reconcile by listing; a future offline-create flow must add a client-generated ID before enabling retries. |
| Home Assistant `create-planned-item` and MCP `create_planned_item` | Same create semantics as REST. | Do not configure transport retries. A stable client-generated ID must be added to the shared schema and service, not only one adapter. |
| Generate shopping list from meal plan | Creates a list and multiple items; no replay identity. | **High risk:** never automatically retry. Reconcile from shopping lists. Add a replay token if automatic retries become necessary. |
| User data import | Multi-record transaction, but repeating can create new records. | **High risk:** do not retry after an uncertain response. Add a replay token tied to the authenticated user and import digest before background retry. |
| Integration-client creation, Pebble pairing, secret rotation, calendar-token creation/regeneration | A retry issues a different credential and may invalidate or orphan the first. | **High risk:** never retry automatically; return to the credential list/status and explicitly rotate again if needed. Secret values cannot be reconstructed without a persisted replay result. |
| Push notification delivery | Successful delivery is recorded in `notification_sent` after the provider call. This suppresses later scheduler runs, but it is not an atomic pre-send claim. Concurrent workers or a process failure between delivery and recording can therefore duplicate a notification. | **High risk:** run only one dispatcher and do not automatically retry an uncertain provider response. Before enabling concurrent dispatchers, add a durable pre-send claim or use a provider idempotency contract, and explicitly choose between at-most-once loss and at-least-once duplication. |
| Account deletion | Multi-record cascade and external identity cleanup. | Delete-to-absent locally; external cleanup must use natural keys and be safely repeatable. A retry may report the account is already absent. |

No generic replay cache is introduced by this audit. If one is added for a row marked “replay token required,” its design must specify all of the following:

1. Scope the key to authenticated principal, operation name, and exact payload digest; reusing a key with another payload returns `409`.
2. Store the completed status and response atomically with the domain write so a concurrent duplicate observes either the in-progress claim or original result.
3. Preserve the original authorization decision and audit actor. A replay returns the stored result and does not manufacture a second domain audit event.
4. Publish a retry window and bounded retention period in the API contract.
5. Clean expired records with the reusable VPS scheduler, never an in-process timer. Alert on failed cleanup and bound table growth independently of traffic.

## Client contracts

- The browser offline queue may replay only operations in the naturally safe table. Create, relative (`defer`/`snooze`), credential, and import/generation requests must not be queued without a stable client-generated ID or replay token.
- Android WorkManager and notification actions follow the same rule: retry reads and absolute status transitions; do not retry non-idempotent creates or relative mutations after an uncertain response.
- Home Assistant service calls and MCP clients must use the annotations and operation-specific rules above. “Non-destructive” does **not** mean idempotent.
- Authentication is evaluated on every attempt. A stored replay result, if later introduced, is returned only to a currently authorized principal in the same scope as the original execution.

## Verification map

High-risk guarantees are exercised by the following tests:

- `backend/tests/test_shopping_lists.py` repeats recurring-grocery import and verifies that the same item IDs are returned.
- `backend/tests/test_recurring_planned_items.py` repeats recurrence materialization and verifies one logical item per series/date.
- `backend/tests/test_households.py` verifies duplicate membership rejection.
- `backend/tests/test_today_route_integration.py` verifies the bulk transaction boundary and per-item results.
- `pebble/tests/offline.test.mjs` verifies repeated input suppression, stale-state conflict handling, and uncertain-response retry behavior.

When a guarantee moves from “caller must not retry” to server-supported retries, add two tests at the service/API boundary: (1) a sequential lost-response replay returns the original result without a second audit/side effect, and (2) concurrent requests with the same identity create exactly one domain result.

## Contributor checklist

Every new externally callable write must update this inventory and state:

1. which strategy applies and what response a retry receives;
2. whether concurrent identical and conflicting requests are supported;
3. which REST, MCP, Android, Home Assistant, Pebble, or automation surfaces share it;
4. how authorization and audit attribution behave on a retry; and
5. the sequential-retry and concurrent-duplicate tests that prove the claim.

Do not label a create operation idempotent merely because it is non-destructive, and do not enable an SDK/offline-queue retry until the server contract supports it.
