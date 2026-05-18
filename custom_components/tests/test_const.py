"""Unit tests for custom_components.daynest.const."""

import pytest

from custom_components.daynest.const import parse_integration_contract_version


@pytest.mark.unit
class TestParseIntegrationContractVersion:
    """Tests for parse_integration_contract_version."""

    def test_none_returns_none(self) -> None:
        assert parse_integration_contract_version(None) is None

    def test_empty_string_returns_none(self) -> None:
        assert parse_integration_contract_version("") is None

    def test_whitespace_only_returns_none(self) -> None:
        assert parse_integration_contract_version("   ") is None

    def test_semicolon_format_extracts_version(self) -> None:
        assert parse_integration_contract_version("home-assistant; version=ha.v1") == "ha.v1"

    def test_semicolon_format_with_spaces_extracts_version(self) -> None:
        assert parse_integration_contract_version("home-assistant ; version = ha.v1") == "ha.v1"

    def test_legacy_alias_one_maps_to_ha_v1(self) -> None:
        assert parse_integration_contract_version("1") == "ha.v1"

    def test_raw_ha_v1_passthrough(self) -> None:
        assert parse_integration_contract_version("ha.v1") == "ha.v1"

    def test_unknown_version_passthrough(self) -> None:
        assert parse_integration_contract_version("home-assistant; version=ha.v99") == "ha.v99"

    def test_no_version_segment_returns_full_string(self) -> None:
        assert parse_integration_contract_version("home-assistant") == "home-assistant"

    def test_version_key_must_match_exactly(self) -> None:
        result = parse_integration_contract_version("home-assistant; Version=ha.v1")
        assert result == "home-assistant; Version=ha.v1"

    def test_leading_trailing_whitespace_stripped(self) -> None:
        assert parse_integration_contract_version("  ha.v1  ") == "ha.v1"
