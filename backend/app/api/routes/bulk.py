from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies.auth import get_current_user
from app.api.dependencies.today import get_today_service
from app.models.user import User
from app.schemas.bulk import BulkMutationItem, BulkMutationRequest, BulkMutationResponse, BulkMutationResult, MutationType
from app.services.today_service import TodayService

router = APIRouter(tags=["bulk"])


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
        except Exception as exc:
            results.append(BulkMutationResult(type=mutation.type, id=mutation.id, success=False, error=str(exc)))
    if has_success:
        service.save()
    return BulkMutationResponse(results=results)
