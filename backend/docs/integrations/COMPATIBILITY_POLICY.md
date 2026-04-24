# Integration Compatibility Policy

This policy applies to Daynest Home Assistant and MCP helper endpoints.

## Contract identifiers

Integration responses expose the `X-Integration-Contract` header:

- Home Assistant adapter: `home-assistant; version=ha.v1`
- MCP adapter: `mcp; version=mcp.v1`

Contract versions are additive-major:

- **Patch changes** (version stays `ha.v1`): bug fixes only, no schema removal or type changes.
- **Minor additive changes** (version stays `ha.v1`): optional fields or new endpoints may be added.
- **Major breaking changes** (`ha.v1` -> `ha.v2`): any field removal, rename, type change, or behavior change that can break strict clients.

## What can break and when

Breaking changes are allowed only when all are true:

1. A new major contract (`*.v2+`) is introduced alongside the prior major.
2. The previous major remains supported for at least one stable milestone.
3. The change is documented in `backend/docs/integrations/SCHEMA_CHANGELOG.md` before release.

## Stability guarantees

For a given major contract version:

- Existing response keys remain present.
- Existing key types remain unchanged.
- Existing endpoint paths remain available.
- Authentication semantics (`X-Integration-Key` + scope checks) remain unchanged.

## Client guidance

- Read and log `X-Integration-Contract`.
- Treat unknown keys as additive.
- Pin to a tested major contract.
