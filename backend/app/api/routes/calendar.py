from datetime import date, datetime, timedelta, timezone
from secrets import token_urlsafe
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from icalendar import Calendar, Event
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_user, get_current_user_optional
from app.api.dependencies.today import get_today_service
from app.db.session import get_db
from app.models.planned_item import PlannedItem
from app.models.user import User
from app.schemas.calendar import CalendarFeedResponse, CalendarTokenResponse
from app.schemas.today import CalendarRangeResponse
from app.services.today_service import TodayService

router = APIRouter(tags=["calendar"])

_EXPORT_PAST_DAYS = 60
_EXPORT_FUTURE_DAYS = 365


# --- iCal formatting helpers ---

def _ical_escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def _fold_line(line: str) -> str:
    """Fold long content-lines per RFC 5545 (max 75 octets per line)."""
    result = []
    while len(line.encode("utf-8")) > 75:
        n = 75
        while len(line[:n].encode("utf-8")) > 75:
            n -= 1
        result.append(line[:n])
        line = " " + line[n:]
    result.append(line)
    return "\r\n".join(result)


def _build_ical(event_lines: list[str]) -> str:
    header = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Daynest//Daynest Calendar//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:Daynest",
    ]
    footer = ["END:VCALENDAR"]
    all_lines = header + event_lines + footer
    return "\r\n".join(_fold_line(line) for line in all_lines) + "\r\n"


def _format_utc_ical_datetime(value: str) -> str:
    dt = datetime.fromisoformat(value)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def _format_event(
    *,
    uid: str,
    dtstamp: str,
    summary: str,
    start: dict[str, str],
    end: dict[str, str],
    description: str | None,
    reminder_minutes: int | None,
) -> list[str]:
    lines = [
        "BEGIN:VEVENT",
        f"UID:{_ical_escape(uid)}",
        f"DTSTAMP:{dtstamp}",
    ]
    if "dateTime" in start:
        lines.append(f"DTSTART:{_format_utc_ical_datetime(start['dateTime'])}")
        lines.append(f"DTEND:{_format_utc_ical_datetime(end['dateTime'])}")
    else:
        d = date.fromisoformat(start["date"])
        d_end = date.fromisoformat(end["date"])
        lines.append(f"DTSTART;VALUE=DATE:{d.strftime('%Y%m%d')}")
        lines.append(f"DTEND;VALUE=DATE:{d_end.strftime('%Y%m%d')}")
    lines.append(f"SUMMARY:{_ical_escape(summary)}")
    if description:
        lines.append(f"DESCRIPTION:{_ical_escape(description)}")
    if reminder_minutes and reminder_minutes > 0:
        lines += [
            "BEGIN:VALARM",
            "ACTION:DISPLAY",
            f"TRIGGER:-PT{reminder_minutes}M",
            f"DESCRIPTION:{_ical_escape(summary)}",
            "END:VALARM",
        ]
    lines.append("END:VEVENT")
    return lines


# --- Calendar token endpoints ---

@router.post("/users/me/calendar-token", response_model=CalendarTokenResponse, status_code=status.HTTP_201_CREATED)
def generate_calendar_token(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CalendarTokenResponse:
    token = token_urlsafe(32)
    current_user.calendar_token = token
    db.commit()
    db.refresh(current_user)
    return CalendarTokenResponse(token=token)


@router.get("/users/me/calendar-token", response_model=CalendarTokenResponse)
def get_calendar_token(current_user: User = Depends(get_current_user)) -> CalendarTokenResponse:
    if not current_user.calendar_token:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No calendar token exists; POST to generate one")
    return CalendarTokenResponse(token=current_user.calendar_token)


@router.delete("/users/me/calendar-token", status_code=status.HTTP_204_NO_CONTENT)
def revoke_calendar_token(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    current_user.calendar_token = None
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


_FEED_PAST_DAYS = 7
_FEED_FUTURE_DAYS = 90
_DEFAULT_FEED_DURATION_MINUTES = 60


def _new_calendar_feed_token(db: Session) -> str:
    for _ in range(10):
        token = token_urlsafe(32)
        exists = db.scalar(select(User.id).where(User.calendar_feed_token == token))
        if exists is None:
            return token
    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not generate calendar feed token")


def _calendar_feed_response(request: Request, user: User) -> CalendarFeedResponse:
    token = user.calendar_feed_token
    if token is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Calendar feed token missing")
    return CalendarFeedResponse(
        token=token,
        feed_url=str(request.url_for("get_calendar_feed_ics", token=token)),
    )


@router.get("/calendar/feed", response_model=CalendarFeedResponse)
def get_calendar_feed(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CalendarFeedResponse:
    if current_user.calendar_feed_token is None:
        current_user.calendar_feed_token = _new_calendar_feed_token(db)
        db.commit()
        db.refresh(current_user)
    return _calendar_feed_response(request, current_user)


@router.post("/calendar/feed/regenerate", response_model=CalendarFeedResponse)
def regenerate_calendar_feed(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CalendarFeedResponse:
    current_user.calendar_feed_token = _new_calendar_feed_token(db)
    db.commit()
    db.refresh(current_user)
    return _calendar_feed_response(request, current_user)


def _planned_item_start(item: PlannedItem, tz: ZoneInfo) -> date | datetime:
    if item.time_of_day is None:
        return item.planned_for
    return datetime.combine(item.planned_for, item.time_of_day, tzinfo=tz)


def _planned_item_end(item: PlannedItem, start: date | datetime) -> date | datetime:
    if isinstance(start, datetime):
        minutes = item.duration_minutes or _DEFAULT_FEED_DURATION_MINUTES
        return start + timedelta(minutes=minutes)
    return start + timedelta(days=1)


def _build_planned_items_calendar(user: User, planned_items: list[PlannedItem]) -> bytes:
    calendar = Calendar()
    calendar.add("prodid", "-//Daynest//Planned Items//EN")
    calendar.add("version", "2.0")
    calendar.add("calscale", "GREGORIAN")
    calendar.add("method", "PUBLISH")
    calendar.add("x-wr-calname", "Daynest")

    try:
        tz = ZoneInfo(user.timezone)
    except ZoneInfoNotFoundError:
        tz = ZoneInfo("UTC")

    dtstamp = datetime.now(timezone.utc)
    for item in planned_items:
        event = Event()
        start = _planned_item_start(item, tz)
        event.add("uid", f"daynest-{item.id}@daynest")
        event.add("dtstamp", dtstamp)
        event.add("dtstart", start)
        event.add("dtend", _planned_item_end(item, start))
        event.add("summary", item.title)
        if item.notes:
            event.add("description", item.notes)
        calendar.add_component(event)

    return calendar.to_ical()


@router.get("/calendar/feed/{token}.ics", name="get_calendar_feed_ics")
def get_calendar_feed_ics(token: str, db: Session = Depends(get_db)) -> Response:
    user = db.scalar(select(User).where(User.calendar_feed_token == token).where(User.is_active.is_(True)))
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Calendar feed not found")

    try:
        feed_tz = ZoneInfo(user.timezone)
    except ZoneInfoNotFoundError:
        feed_tz = ZoneInfo("UTC")
    today = datetime.now(feed_tz).date()
    start_date = today - timedelta(days=_FEED_PAST_DAYS)
    end_date = today + timedelta(days=_FEED_FUTURE_DAYS)
    planned_items = list(
        db.scalars(
            select(PlannedItem)
            .where(PlannedItem.user_id == user.id)
            .where(PlannedItem.planned_for >= start_date)
            .where(PlannedItem.planned_for <= end_date)
            .order_by(PlannedItem.planned_for, PlannedItem.time_of_day, PlannedItem.id)
        )
    )

    return Response(
        content=_build_planned_items_calendar(user, planned_items),
        media_type="text/calendar; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="daynest-planned-items.ics"',
            "Cache-Control": "private, no-store",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )

# --- Calendar range ---

@router.get("/calendar/range", response_model=CalendarRangeResponse)
def get_calendar_range(
    start_date: date = Query(..., alias="start"),
    end_date: date = Query(..., alias="end"),
    service: TodayService = Depends(get_today_service),
    current_user: User = Depends(get_current_user),
) -> CalendarRangeResponse:
    return service.get_calendar_range(user_id=current_user.id, start_date=start_date, end_date=end_date)


# --- iCal export ---

def _resolve_user(
    token: str | None,
    bearer_user: User | None,
    db: Session,
) -> User:
    if bearer_user is not None:
        return bearer_user
    if token:
        user = db.scalar(select(User).where(User.calendar_token == token).where(User.is_active.is_(True)))
        if user:
            return user
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Provide a Bearer token or a valid ?token= calendar token",
        headers={"WWW-Authenticate": "Bearer"},
    )


@router.get("/calendar/export.ics")
def export_ical(
    token: str | None = Query(default=None, description="Per-user calendar subscription token"),
    db: Session = Depends(get_db),
    service: TodayService = Depends(get_today_service),
    bearer_user: User | None = Depends(get_current_user_optional),
) -> Response:
    user = _resolve_user(token, bearer_user, db)

    today = datetime.now(ZoneInfo(user.timezone)).date()
    start_date = today - timedelta(days=_EXPORT_PAST_DAYS)
    end_date = today + timedelta(days=_EXPORT_FUTURE_DAYS)

    events = service.get_calendar_events(user_id=user.id, start_date=start_date, end_date=end_date)
    reminder_minutes = user.medication_reminder_minutes
    dtstamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    event_lines: list[str] = []
    for event in events:
        is_medication = event.uid.startswith("daynest_medication_")
        event_lines.extend(_format_event(
            uid=event.uid,
            dtstamp=dtstamp,
            summary=event.summary,
            start=event.start,
            end=event.end,
            description=event.description,
            reminder_minutes=reminder_minutes if is_medication else None,
        ))

    return Response(
        content=_build_ical(event_lines),
        media_type="text/calendar; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="daynest.ics"',
            "Cache-Control": "private, no-store",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )
