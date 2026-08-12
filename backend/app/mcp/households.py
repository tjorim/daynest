"""Read-only household collaboration MCP operations."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from sqlalchemy.orm import Session

from app.mcp.context import jsonable, with_principal
from app.mcp.errors import map_domain_errors
from app.mcp.principal import McpPrincipal
from app.repositories.household_repository import HouseholdRepository

SessionFactory = Callable[[], Session]


def _serialize(repo: HouseholdRepository, household: Any) -> dict[str, Any]:
    return jsonable(
        {
            "id": household.id,
            "name": household.name,
            "created_at": household.created_at,
            "members": [
                {
                    "user_id": member.user.id,
                    "email": member.user.email,
                    "full_name": member.user.full_name,
                    "role": member.role,
                    "joined_at": member.created_at,
                }
                for member in repo.list_members(household.id)
            ],
        }
    )


@map_domain_errors
def list_households(session_factory: SessionFactory, user_email: str | None) -> list[dict[str, Any]]:
    def _op(db: Session, principal: McpPrincipal) -> list[dict[str, Any]]:
        repo = HouseholdRepository(db)
        return [_serialize(repo, household) for household in repo.list_user_households(principal.user.id)]

    return with_principal(session_factory, user_email, _op)


@map_domain_errors
def get_household(session_factory: SessionFactory, user_email: str | None, household_id: int) -> dict[str, Any]:
    def _op(db: Session, principal: McpPrincipal) -> dict[str, Any]:
        repo = HouseholdRepository(db)
        household = repo.get_household(household_id)
        if household is None:
            raise ValueError("Household not found")
        if repo.get_membership(household_id, principal.user.id) is None:
            raise PermissionError("You are not a member of this household")
        return _serialize(repo, household)

    return with_principal(session_factory, user_email, _op)
