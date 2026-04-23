from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.repositories.today_repository import TodayRepository
from app.schemas.today import TodayResponse
from app.services.today_service import TodayService

router = APIRouter(tags=["today"])


@router.get("/today", response_model=TodayResponse)
def get_today(db: Session = Depends(get_db)) -> TodayResponse:
    repository = TodayRepository(db)
    service = TodayService(repository)
    return service.get_today(date.today())
