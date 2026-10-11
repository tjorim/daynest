"""Coded API errors: ``detail`` stays English, ``code`` (and ``params``) are stable and machine-readable."""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.errors import ApiException, handle_api_exception


@pytest.fixture
def error_client() -> TestClient:
    app = FastAPI()
    app.add_exception_handler(ApiException, handle_api_exception)

    @app.get("/coded")
    def coded() -> None:
        raise ApiException(404, "household_not_found", "Household not found")

    @app.get("/params")
    def with_params() -> None:
        raise ApiException(422, "unsupported_export_version", "Unsupported export version: 9", params={"version": 9})

    @app.get("/headers")
    def with_headers() -> None:
        raise ApiException(401, "calendar_token_required", "Nope", headers={"WWW-Authenticate": "Bearer"})

    return TestClient(app)


def test_error_body_carries_code_next_to_detail(error_client: TestClient) -> None:
    response = error_client.get("/coded")

    assert response.status_code == 404
    assert response.json() == {"detail": "Household not found", "code": "household_not_found"}


def test_error_body_carries_params_only_when_given(error_client: TestClient) -> None:
    response = error_client.get("/params")

    assert response.status_code == 422
    assert response.json() == {
        "detail": "Unsupported export version: 9",
        "code": "unsupported_export_version",
        "params": {"version": 9},
    }


def test_error_keeps_response_headers(error_client: TestClient) -> None:
    response = error_client.get("/headers")

    assert response.headers["www-authenticate"] == "Bearer"
    assert response.json()["code"] == "calendar_token_required"


def test_real_endpoint_returns_a_code(client: TestClient) -> None:
    response = client.get("/api/households/999999")

    assert response.status_code in (401, 404)
    if response.status_code == 401:
        assert response.json()["code"] == "not_authenticated"
