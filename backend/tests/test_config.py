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
