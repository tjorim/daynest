"""Regression coverage for expanded owner-scoped MCP capabilities."""

from sqlalchemy.orm import Session, sessionmaker

from app.mcp_server import DaynestMcpBackend
from app.models.user import User
from app.repositories.household_repository import HouseholdRepository


def _backend(db_session: Session) -> DaynestMcpBackend:
    user = User(
        email="mcp-gaps@example.com",
        full_name="MCP Gaps",
        password_hash="hashed",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    factory = sessionmaker(bind=db_session.bind, expire_on_commit=False)
    return DaynestMcpBackend(factory, user_email=user.email)


def test_analytics_and_cross_module_search_are_owner_scoped(
    db_session: Session,
) -> None:
    backend = _backend(db_session)

    summary = backend.get_analytics_summary("week")
    search = backend.search_daynest("nothing", limit=5)

    assert summary["period"] == "week"
    assert search["query"] == "nothing"
    assert search["count"] == 0


def test_household_reads_are_scoped_to_members(db_session: Session) -> None:
    backend = _backend(db_session)
    user = db_session.query(User).filter_by(email="mcp-gaps@example.com").one()
    household = HouseholdRepository(db_session).create_household("Home", user)

    assert backend.list_households()[0]["name"] == "Home"
    assert backend.get_household(household.id)["members"][0]["user_id"] == user.id


def test_integration_client_rotation_and_revocation(db_session: Session) -> None:
    backend = _backend(db_session)

    created = backend.create_integration_client("Automation")
    rotated = backend.rotate_integration_client(created["id"])
    revoked = backend.revoke_integration_client(created["id"])

    assert rotated["api_key"] != created["api_key"]
    assert revoked == {"revoked": True, "client_id": created["id"]}
