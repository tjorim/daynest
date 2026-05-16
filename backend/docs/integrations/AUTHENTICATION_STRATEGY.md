# Daynest authentication strategy: local auth vs Keycloak/OIDC

## Recommendation

Adopt a **hybrid strategy**:

1. **Keep Daynest local auth as the current default** (email/password + local JWT + refresh-token rotation).
2. **Add optional OIDC (Keycloak) for browser SSO** only when cross-app SSO is an explicit product goal.
3. **Keep integration/API keys separate** from human login auth regardless of browser auth choice.

This keeps Daynest simple for standalone use, avoids forced migration risk, and leaves a clean path to centralized identity when needed.

## Why this direction

### SSO value vs migration cost

- SSO is valuable when users actively switch between Daynest, Worktime, and Champagne Festival in the same sessions.
- Today, Daynest has strong standalone + integration workflows (mobile usage, Home Assistant, API integrations) that already work well with local auth.
- Immediate full migration to OIDC would add client complexity (especially mobile), token/session behavior changes, and identity migration risk.

**Conclusion:** do not force a full cutover yet. Ship OIDC as an additive option first.

## Answers to the key questions

### Would SSO across personal apps justify migration?

- **Not by default.** It justifies migration only if cross-app switching and centralized identity management become active product priorities.
- Until then, local auth provides a lower operational and product complexity baseline.

### How would existing users map to Keycloak identities?

Use deterministic mapping in this order:

1. Match by normalized, verified email.
2. Persist `keycloak_subject` (`sub`) mapping in Daynest once linked.
3. Keep a unique constraint on `(identity_provider, provider_subject)` for future multi-IdP support.
4. For collisions (same email, multiple users), block auto-link and require explicit account-link flow.

### What happens to current refresh-token/session behavior?

- **Local auth users:** no change; keep current rotating refresh-token model.
- **OIDC users:** browser session uses OIDC auth-code flow tokens; Keycloak session lifetime/policies govern renewal.
- Daynest should still maintain a short-lived internal session abstraction (or internal access token) after OIDC login so API authorization remains consistent.

### How should Home Assistant auth work if browser login moves to OIDC?

- Keep Home Assistant on **integration keys** (`X-Integration-Key`) with scoped permissions (`ha:read`, `ha:write`).
- Do **not** require Home Assistant to perform OIDC browser login.
- OIDC affects human login UX; machine-to-machine auth remains key-based.

### Do mobile/app clients need PKCE/OIDC support?

- If mobile login is moved to OIDC, yes: use **Authorization Code + PKCE** with system browser and deep-link callback.
- In hybrid phase, mobile can stay on local auth until PKCE support is implemented and validated.

### Should Daynest keep local API/integration keys separate from human login?

- **Yes.** Keep integration keys as a separate credential type and lifecycle.
- This preserves least privilege (scopes/rate limits), automation stability, and avoids coupling machine access to human SSO sessions.

### Is a hybrid model needed during migration?

- **Yes.** Hybrid is the safest migration path.

## Required changes for the recommended hybrid direction

### Backend

- Add optional OIDC configuration (issuer, client ID, audience, JWKS URL, redirect URLs).
- Add OIDC callback/link endpoints for browser login.
- Add identity-link persistence (e.g., `user_id`, `provider`, `provider_subject`, `linked_at`).
- Keep existing `/auth/register`, `/auth/login`, `/auth/refresh` for local-auth users during transition.
- Keep integration-key routes and auth dependency unchanged.

### Schema

- New table (or equivalent) for external identities:
  - `user_external_identities(id, user_id, provider, provider_subject, email_at_link, created_at)`
  - unique `(provider, provider_subject)`
  - index on `user_id`
- Optional user-level auth mode marker (`local`, `oidc_linked`, `oidc_only`) if needed for policy enforcement.

### Frontend (web)

- Add "Continue with SSO" entry point when OIDC is enabled.
- Handle OIDC redirect/callback and session bootstrap.
- Keep email/password UI while hybrid mode is active.
- Add account settings surface for linking/unlinking OIDC identity (with safeguards).

### Mobile/Android

- No mandatory immediate change in phase 1.
- If/when migrated: implement PKCE flow, deep-link callback handling, secure token storage updates.

### Config/operations

- Add env/config flags:
  - `AUTH_MODE` (`local`, `hybrid`, `oidc_only`)
  - OIDC issuer/client settings
  - allowed redirect URIs per environment
- Define Keycloak realm/client setup and role/scope mapping.
- Add observability for login method, link failures, and OIDC callback errors.

## Migration plan (if OIDC is adopted)

1. **Phase 0: Preparation**
   - Introduce OIDC config and external identity schema.
   - Keep default `AUTH_MODE=local`.
2. **Phase 1: Optional SSO (hybrid)**
   - Enable OIDC button for selected users/environments.
   - First successful OIDC login links by verified email; unresolved collisions require manual linking.
3. **Phase 2: Progressive rollout**
   - Encourage OIDC for web users; keep local fallback.
   - Monitor failed links, login failures, and support incidents.
4. **Phase 3: Policy decision**
   - Decide whether to remain hybrid long-term or move to `oidc_only` for human login.
5. **Phase 4 (optional): OIDC-only human auth**
   - Disable local password login for linked users (or globally).
   - Keep integration keys active and separately managed.

### Existing token handling during migration

- Existing local refresh tokens remain valid until expiry/revocation.
- OIDC login does not need to invalidate integration keys.
- If switching a user to `oidc_only`, revoke that user's outstanding local refresh tokens at cutover.

## Final decision status

- **Current recommendation:** stay local by default, add OIDC only in hybrid mode when SSO is a confirmed product goal.
- **Explicit non-goal right now:** replacing integration keys (Home Assistant/MCP) with OIDC.
