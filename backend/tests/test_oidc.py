from __future__ import annotations

import pytest

from app.core import oidc


@pytest.mark.anyio
async def test_decode_oidc_token_dev_bypass_returns_fixed_claims(monkeypatch) -> None:
    monkeypatch.setattr(oidc.settings, "dev_auth_bypass_token", "test-bypass-token")

    claims = await oidc.decode_oidc_token("test-bypass-token")

    assert claims == oidc._DEV_BYPASS_CLAIMS
    assert claims["realm_access"]["roles"] == ["admin"]


@pytest.mark.anyio
async def test_decode_oidc_token_wrong_token_does_not_trigger_bypass(monkeypatch) -> None:
    monkeypatch.setattr(oidc.settings, "dev_auth_bypass_token", "test-bypass-token")
    monkeypatch.setattr(oidc.settings, "oidc_issuer_url", None)
    monkeypatch.setattr(oidc.settings, "oidc_jwks_uri", None)

    with pytest.raises(oidc.OIDCTokenError):
        await oidc.decode_oidc_token("not-the-bypass-token")


@pytest.mark.anyio
async def test_decode_oidc_token_bypass_disabled_by_default(monkeypatch) -> None:
    monkeypatch.setattr(oidc.settings, "dev_auth_bypass_token", None)
    monkeypatch.setattr(oidc.settings, "oidc_issuer_url", None)
    monkeypatch.setattr(oidc.settings, "oidc_jwks_uri", None)

    with pytest.raises(oidc.OIDCTokenError):
        await oidc.decode_oidc_token("test-bypass-token")
