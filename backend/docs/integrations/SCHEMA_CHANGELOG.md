# Integration Schema Changelog

Tracks integration-facing schema and contract changes for Home Assistant and MCP helper endpoints.

## 2026-04-24

### Added

- Introduced `X-Integration-Contract` response header for integration endpoints.
- Home Assistant endpoints now emit `home-assistant; version=ha.v1`.
- MCP endpoints now emit `mcp; version=mcp.v1`.
- Added contract tests that pin core response keys and contract headers.

### Compatibility impact

- Non-breaking additive change.
- Existing response bodies and endpoint paths are unchanged.
