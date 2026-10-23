"""Write contracts reject stale fields while preserving response and patch behavior."""

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_user
from app.main import app
from app.models.user import User
from app.schemas.bulk import BulkMutationRequest
from app.schemas.households import InviteRequest
from app.schemas.shopping_list import ShoppingListUpdateRequest
from app.schemas.templates import RoutineTemplateCreateRequest, RoutineTemplateResponse


def test_unknown_household_field_does_not_create_a_row(client: TestClient, db_session: Session) -> None:
    user = User(email="owner@example.com", full_name="Owner", is_active=True)
    db_session.add(user)
    db_session.commit()
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        response = client.post("/api/households", json={"name": "Home", "nmae": "Lost"})
        assert response.status_code == 422
        assert client.get("/api/households").json() == []
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_nested_bulk_action_rejects_unknown_fields() -> None:
    with pytest.raises(ValidationError) as error:
        BulkMutationRequest.model_validate({"mutations": [{"type": "complete_chore", "id": 1, "unexpected": True}]})
    assert error.value.errors()[0]["type"] == "extra_forbidden"
    assert error.value.errors()[0]["loc"] == ("mutations", 0, "unexpected")


def test_template_write_rejects_response_metadata_but_response_stays_permissive() -> None:
    payload = {"name": "Morning", "start_date": "2026-10-23", "id": 1, "created_at": "2026-10-23T10:00:00Z"}
    with pytest.raises(ValidationError) as error:
        RoutineTemplateCreateRequest.model_validate(payload)
    assert {item["loc"] for item in error.value.errors()} == {("id",), ("created_at",)}
    response = RoutineTemplateResponse.model_validate({**payload, "future_metadata": True})
    assert response.name == "Morning"


def test_patch_preserves_omission_and_explicit_null() -> None:
    assert ShoppingListUpdateRequest().model_dump(exclude_unset=True) == {}
    assert ShoppingListUpdateRequest(notes=None).model_dump(exclude_unset=True) == {"notes": None}
    with pytest.raises(ValidationError):
        ShoppingListUpdateRequest(name=None)


@pytest.mark.parametrize("email", ["broken", "name@", "@example.com"])
def test_invitation_rejects_invalid_email(email: str) -> None:
    with pytest.raises(ValidationError):
        InviteRequest(email=email)


def test_shared_text_constraints_preserve_boundaries() -> None:
    assert RoutineTemplateCreateRequest(name="x" * 255, start_date="2026-10-23").name == "x" * 255
    for name in ("", "x" * 256):
        with pytest.raises(ValidationError):
            RoutineTemplateCreateRequest(name=name, start_date="2026-10-23")
    assert ShoppingListUpdateRequest(notes="x" * 4000).notes == "x" * 4000
    with pytest.raises(ValidationError):
        ShoppingListUpdateRequest(notes="x" * 4001)
