import asyncio
import json
from datetime import date
from typing import Literal, cast

from fastapi import APIRouter, Depends, Query, Request, Response, status
from sse_starlette import EventSourceResponse

from app.api.dependencies.auth import get_current_user, get_current_user_from_query_token
from app.api.dependencies.events import get_event_bus
from app.api.dependencies.today import get_today_service
from app.models.user import User
from app.schemas.today import (
    AssignChoreRequest,
    CalendarDayResponse,
    CalendarMonthResponse,
    ChoreInstanceMutationResponse,
    PlannedItemCreateRequest,
    PlannedItemUpdateRequest,
    PlannedTodayItem,
    RescheduleChoreRequest,
    TaskInstanceMutationResponse,
    TodayResponse,
)
from app.services.event_bus import EventBus
from app.services.today_service import TodayService

router = APIRouter(tags=["today"])


@router.get("/today", response_model=TodayResponse)
def get_today(
    service: TodayService = Depends(get_today_service),
    current_user: User = Depends(get_current_user),
) -> TodayResponse:
    return service.get_today(user_id=current_user.id, for_date=date.today())


@router.get("/today/stream")
async def stream_today_updates(
    request: Request,
    event_bus: EventBus = Depends(get_event_bus),
    current_user: User = Depends(get_current_user_from_query_token),
) -> EventSourceResponse:
    """Today SSE event stream contract.

    **URL**: GET /api/v1/today/stream?token=<access_token>

    Auth uses a query-param token (not a header) because EventSource cannot send
    custom headers.  Pass the OIDC access token as ``?token=``.

    **Events emitted**:
    - ``today_updated`` — data: ``{}``  (invalidation hint; refetch /today)
    - ``ping``          — data: ``{}``  (keepalive every 30 s of inactivity)

    Clients must treat events as invalidation signals and refetch /today; event
    payloads are intentionally empty and carry no authoritative data.

    **Reconnect**: EventSource reconnects automatically on disconnect.  Missed
    events are not replayed; clients must refetch after reconnect.

    **Proxy buffering**: Cache-Control: no-cache and X-Accel-Buffering: no are
    set so that nginx/Caddy do not buffer the stream.

    **Scaling**: EventBus is process-local.  A single-worker deployment (the
    default) is the only supported mode.  Multi-worker setups require a shared
    pub/sub layer that is not currently implemented.
    """
    queue = event_bus.subscribe(current_user.id)

    async def _event_generator():
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30.0)
                    yield {"event": event.get("type", "message"), "data": json.dumps(event.get("data", {}))}
                except TimeoutError:
                    yield {"event": "ping", "data": "{}"}
        finally:
            event_bus.unsubscribe(current_user.id, queue)

    return EventSourceResponse(_event_generator())


@router.get("/calendar/month", response_model=CalendarMonthResponse)
def get_calendar_month(
    year: int = Query(..., ge=1970, le=2100),
    month: int = Query(..., ge=1, le=12),
    service: TodayService = Depends(get_today_service),
    current_user: User = Depends(get_current_user),
) -> CalendarMonthResponse:
    return service.get_month(user_id=current_user.id, year=year, month=month)


@router.get("/calendar/day", response_model=CalendarDayResponse)
def get_calendar_day(
    target_date: date = Query(..., alias="date"),
    service: TodayService = Depends(get_today_service),
    current_user: User = Depends(get_current_user),
) -> CalendarDayResponse:
    return service.get_day_items(user_id=current_user.id, for_date=target_date)


@router.get("/planned-items", response_model=list[PlannedTodayItem])
def list_planned_items(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    tags: str | None = Query(default=None, description="Comma-separated tags to filter by (OR match)"),
    service: TodayService = Depends(get_today_service),
    current_user: User = Depends(get_current_user),
) -> list[PlannedTodayItem]:
    tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else None
    return service.list_planned_items(user_id=current_user.id, start_date=start_date, end_date=end_date, tags=tag_list or None)


@router.post("/planned-items", response_model=PlannedTodayItem)
def create_planned_item(
    request: PlannedItemCreateRequest,
    service: TodayService = Depends(get_today_service),
    event_bus: EventBus = Depends(get_event_bus),
    current_user: User = Depends(get_current_user),
) -> PlannedTodayItem:
    item = service.create_planned_item(user_id=current_user.id, request=request)
    event_bus.publish(current_user.id, {"type": "today_updated"})
    return item


@router.put("/planned-items/{planned_item_id}", response_model=PlannedTodayItem)
def update_planned_item(
    planned_item_id: int,
    request: PlannedItemUpdateRequest,
    scope: str = Query(
        default="this",
        pattern="^(this|future|all)$",
        description="Update scope: 'this' updates only this item; 'future' updates this and future items in the same series; 'all' updates all items in the same series.",
    ),
    service: TodayService = Depends(get_today_service),
    event_bus: EventBus = Depends(get_event_bus),
    current_user: User = Depends(get_current_user),
) -> PlannedTodayItem:
    item = service.update_planned_item(
        user_id=current_user.id,
        planned_item_id=planned_item_id,
        request=request,
        scope=cast(Literal["this", "future", "all"], scope),
    )
    event_bus.publish(current_user.id, {"type": "today_updated"})
    return item


@router.post("/planned-items/{planned_item_id}/defer", response_model=PlannedTodayItem)
def defer_planned_item(
    planned_item_id: int,
    days: int = Query(default=1, ge=1),
    service: TodayService = Depends(get_today_service),
    event_bus: EventBus = Depends(get_event_bus),
    current_user: User = Depends(get_current_user),
) -> PlannedTodayItem:
    item = service.defer_planned_item(user_id=current_user.id, planned_item_id=planned_item_id, days=days)
    event_bus.publish(current_user.id, {"type": "today_updated"})
    return item


@router.delete("/planned-items/{planned_item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_planned_item(
    planned_item_id: int,
    scope: str = Query(
        default="this",
        pattern="^(this|future)$",
        description="Delete scope: 'this' removes only this item; 'future' removes this and future items in the same series.",
    ),
    service: TodayService = Depends(get_today_service),
    event_bus: EventBus = Depends(get_event_bus),
    current_user: User = Depends(get_current_user),
) -> Response:
    service.delete_planned_item(user_id=current_user.id, planned_item_id=planned_item_id, scope=cast(Literal["this", "future"], scope))
    event_bus.publish(current_user.id, {"type": "today_updated"})
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/chores/{chore_instance_id}/assign", response_model=ChoreInstanceMutationResponse)
def assign_chore(
    chore_instance_id: int,
    request: AssignChoreRequest,
    service: TodayService = Depends(get_today_service),
    event_bus: EventBus = Depends(get_event_bus),
    current_user: User = Depends(get_current_user),
) -> ChoreInstanceMutationResponse:
    result = service.assign_chore(
        user_id=current_user.id,
        chore_instance_id=chore_instance_id,
        assigned_to=request.assigned_to,
    )
    event_bus.publish(current_user.id, {"type": "today_updated"})
    if request.assigned_to is not None and request.assigned_to != current_user.id:
        event_bus.publish(request.assigned_to, {"type": "today_updated"})
    return result


@router.post("/chores/{chore_instance_id}/complete", response_model=ChoreInstanceMutationResponse)
def complete_chore(
    chore_instance_id: int,
    service: TodayService = Depends(get_today_service),
    event_bus: EventBus = Depends(get_event_bus),
    current_user: User = Depends(get_current_user),
) -> ChoreInstanceMutationResponse:
    result = service.complete_chore(user_id=current_user.id, chore_instance_id=chore_instance_id)
    event_bus.publish(current_user.id, {"type": "today_updated"})
    return result


@router.post("/chores/{chore_instance_id}/skip", response_model=ChoreInstanceMutationResponse)
def skip_chore(
    chore_instance_id: int,
    service: TodayService = Depends(get_today_service),
    event_bus: EventBus = Depends(get_event_bus),
    current_user: User = Depends(get_current_user),
) -> ChoreInstanceMutationResponse:
    result = service.skip_chore(user_id=current_user.id, chore_instance_id=chore_instance_id)
    event_bus.publish(current_user.id, {"type": "today_updated"})
    return result


@router.post("/chores/{chore_instance_id}/reschedule", response_model=ChoreInstanceMutationResponse)
def reschedule_chore(
    chore_instance_id: int,
    request: RescheduleChoreRequest,
    service: TodayService = Depends(get_today_service),
    event_bus: EventBus = Depends(get_event_bus),
    current_user: User = Depends(get_current_user),
) -> ChoreInstanceMutationResponse:
    result = service.reschedule_chore(
        user_id=current_user.id,
        chore_instance_id=chore_instance_id,
        scheduled_date=request.scheduled_date,
    )
    event_bus.publish(current_user.id, {"type": "today_updated"})
    return result


@router.post("/tasks/{task_instance_id}/start", response_model=TaskInstanceMutationResponse)
def start_task(
    task_instance_id: int,
    service: TodayService = Depends(get_today_service),
    event_bus: EventBus = Depends(get_event_bus),
    current_user: User = Depends(get_current_user),
) -> TaskInstanceMutationResponse:
    result = service.start_routine_task(user_id=current_user.id, task_instance_id=task_instance_id)
    event_bus.publish(current_user.id, {"type": "today_updated"})
    return result


@router.post("/tasks/{task_instance_id}/complete", response_model=TaskInstanceMutationResponse)
def complete_task(
    task_instance_id: int,
    service: TodayService = Depends(get_today_service),
    event_bus: EventBus = Depends(get_event_bus),
    current_user: User = Depends(get_current_user),
) -> TaskInstanceMutationResponse:
    result = service.complete_routine_task(user_id=current_user.id, task_instance_id=task_instance_id)
    event_bus.publish(current_user.id, {"type": "today_updated"})
    return result


@router.post("/tasks/{task_instance_id}/skip", response_model=TaskInstanceMutationResponse)
def skip_task(
    task_instance_id: int,
    service: TodayService = Depends(get_today_service),
    event_bus: EventBus = Depends(get_event_bus),
    current_user: User = Depends(get_current_user),
) -> TaskInstanceMutationResponse:
    result = service.skip_routine_task(user_id=current_user.id, task_instance_id=task_instance_id)
    event_bus.publish(current_user.id, {"type": "today_updated"})
    return result
