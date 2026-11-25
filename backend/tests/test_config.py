import pytest
from pydantic import ValidationError

from app.core.config import AppSettings


def _base_kwargs() -> dict:
    return {
        "environment": "staging",
        "db_password": "secret",
        "oidc_issuer_url": "https://auth.example.com",
        "oidc_audience": "daynest",
        "integration_key_hash_secret": "secret",
    }


def test_trusted_hosts_default_rejected_in_non_dev():
    with pytest.raises(ValidationError, match="TRUSTED_HOSTS must be set in non-dev environments"):
        AppSettings(_env_file=None, **_base_kwargs())


def test_trusted_hosts_explicit_in_non_dev_succeeds():
    settings = AppSettings(_env_file=None, trusted_hosts="daynest.example", **_base_kwargs())
    assert settings.trusted_hosts == ["daynest.example"]


def test_trusted_hosts_default_allowed_in_dev():
    settings = AppSettings(_env_file=None, environment="dev")
    assert settings.trusted_hosts == ["localhost", "127.0.0.1"]


def test_dev_auth_bypass_token_rejected_in_non_dev():
    with pytest.raises(ValidationError, match="DEV_AUTH_BYPASS_TOKEN must not be set outside environment=dev"):
        AppSettings(
            _env_file=None, trusted_hosts="daynest.example", dev_auth_bypass_token="some-token", **_base_kwargs()
        )


def test_dev_auth_bypass_token_allowed_in_dev():
    settings = AppSettings(_env_file=None, environment="dev", dev_auth_bypass_token="some-token")
    assert settings.dev_auth_bypass_token == "some-token"


def test_home_assistant_oidc_client_id_default_and_environment(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("OIDC_HOME_ASSISTANT_CLIENT_ID", raising=False)
    assert AppSettings(_env_file=None, environment="dev").oidc_home_assistant_client_id == "home-assistant"

    monkeypatch.setenv("OIDC_HOME_ASSISTANT_CLIENT_ID", "renamed-home-assistant")
    assert AppSettings(_env_file=None, environment="dev").oidc_home_assistant_client_id == "renamed-home-assistant"


@pytest.mark.parametrize(
    "url",
    [
        "daynest",
        "https://daynest.example/mcp",
        "https://daynest.example/mcp/?unexpected=true",
        "https://user@daynest.example/mcp/",
    ],
)
def test_mcp_resource_url_requires_canonical_endpoint(url: str):
    with pytest.raises(ValidationError, match="mcp_resource_url"):
        AppSettings(_env_file=None, oidc_audience="daynest", mcp_resource_url=url)


def test_mcp_resource_url_requires_the_rest_api_audience(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("OIDC_AUDIENCE", raising=False)

    with pytest.raises(ValidationError, match="OIDC_AUDIENCE must be set when MCP_RESOURCE_URL is"):
        AppSettings(_env_file=None, environment="dev", mcp_resource_url="http://localhost:8000/mcp/")
    assert AppSettings(
        _env_file=None, environment="dev", oidc_audience="daynest", mcp_resource_url="http://localhost:8000/mcp/"
    ).mcp_resource_url


def test_retired_mcp_base_url_fails_loudly(monkeypatch: pytest.MonkeyPatch, tmp_path):
    monkeypatch.delenv("MCP_BASE_URL", raising=False)
    monkeypatch.delenv("MCP_RESOURCE_URL", raising=False)
    monkeypatch.setenv("MCP_BASE_URL", "https://daynest.example/mcp")
    with pytest.raises(ValidationError, match="MCP_BASE_URL is no longer read"):
        AppSettings(_env_file=None, environment="dev")
    monkeypatch.delenv("MCP_BASE_URL")

    env_file = tmp_path / ".env"
    env_file.write_text("MCP_BASE_URL=https://daynest.example/mcp\n")
    with pytest.raises(ValidationError, match="MCP_BASE_URL is no longer read"):
        AppSettings(_env_file=env_file, environment="dev")
    env_file.write_text(
        "OIDC_AUDIENCE=daynest\nMCP_BASE_URL=https://daynest.example/mcp\nMCP_RESOURCE_URL=https://daynest.example/mcp/\n"
    )
    assert AppSettings(_env_file=env_file, environment="dev").mcp_resource_url == "https://daynest.example/mcp/"
