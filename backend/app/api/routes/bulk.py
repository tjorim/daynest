import logging

from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies.auth import get_current_user
from app.api.dependencies.events import get_event_bus
from app.api.dependencies.today import get_today_service
from app.models.user import User
from app.schemas.bulk import BulkMutationItem, BulkMutationRequest, BulkMutationResponse, BulkMutationResult, MutationType
from app.services.event_bus import EventBus
from app.services.today_service import TodayService

router = APIRouter(tags=["bulk"])
logger = logging.getLogger(__name__)


def _apply_mutation(service: TodayService, user_id: int, mutation: BulkMutationItem) -> None:
    if mutation.type == MutationType.complete_chore:
        service.complete_chore(user_id=user_id, chore_instance_id=mutation.id, persist=False)
    elif mutation.type == MutationType.skip_chore:
        service.skip_chore(user_id=user_id, chore_instance_id=mutation.id, persist=False)
    elif mutation.type == MutationType.mark_planned_done:
        service.mark_planned_done(user_id=user_id, planned_item_id=mutation.id, persist=False)


@router.post("/bulk", response_model=BulkMutationResponse)
def bulk_mutate(
    request: BulkMutationRequest,
    service: TodayService = Depends(get_today_service),
    event_bus: EventBus = Depends(get_event_bus),
    current_user: User = Depends(get_current_user),
) -> BulkMutationResponse:
    results: list[BulkMutationResult] = []
    has_success = False
    for mutation in request.mutations:
        try:
            _apply_mutation(service, current_user.id, mutation)
            results.append(BulkMutationResult(type=mutation.type, id=mutation.id, success=True))
            has_success = True
        except HTTPException as exc:
            results.append(BulkMutationResult(type=mutation.type, id=mutation.id, success=False, error=exc.detail))
        except Exception:
            # Bulk operations are best-effort: one unexpected item failure must not hide
            # successful sibling mutations, but it is logged with mutation context.
            logger.exception("Unexpected error applying mutation type=%s id=%s", mutation.type, mutation.id)
            results.append(BulkMutationResult(type=mutation.type, id=mutation.id, success=False, error="failed to apply mutation"))
    if has_success:
        try:
            service.save()
            event_bus.publish(current_user.id, {"type": "today_updated"})
        except Exception:
            # Persistence/event publication is the transaction boundary for the batch.
            logger.exception("Failed to persist bulk mutations")
            for r in results:
                if r.success:
                    r.success = False
                    r.error = "persist error"
    return BulkMutationResponse(results=results)
