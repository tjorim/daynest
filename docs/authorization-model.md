# Authorization model

Keycloak remains the identity authority for web, Android, and user-driven MCP
access. Interactive clients use Authorization Code with PKCE. The backend
normalizes each request into a principal containing subject, local user,
authorized client, authentication type, roles, and scopes.

Non-interactive integration credentials are separate delegated identities:

- `home_assistant:*` permits the Home Assistant adapter.
- `pebble:read` permits the watch dashboard.
- `pebble:write` permits the watch quick actions.
- `mcp:*` permits MCP tools.
- `integration:*` is the migration-only compatibility scope assigned to
  credentials created before explicit scopes existed.

New integration clients select their purpose in Settings and receive only that
purpose's scopes. Pebble uses `/api/integrations/pebble/*`; Home Assistant uses
`/api/integrations/home-assistant/*`. Neither credential can cross into the
other adapter or into MCP.

Use separate public Keycloak clients for the web SPA and Android app. Both use
Authorization Code + PKCE, but separate client IDs make redirect URIs, logout
URIs, session revocation, and audit provenance unambiguous. The web app keeps
OIDC state in session storage and no longer requests `offline_access` by
default. Android keeps AppAuth state in encrypted storage and may request
offline access for mobile refresh.

A Keycloak service account may use MCP only when a trusted protocol mapper adds
`daynest_user_id` to its access token. The MCP server rejects an unmapped
service account rather than creating a local human account for it. User-driven
MCP sessions continue to resolve by Keycloak `sub`.

Deploy the backend migration before the updated backend:

```sh
uv run alembic upgrade head
```

`docs/release-validation.md` is the runbook for verifying this model on real
clients — the interactive login/logout and pairing flows that automated tests
cannot cover.
