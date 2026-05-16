from fastapi import Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.repositories.today_repository import TodayRepository
from app.services.today_service import TodayService


def get_today_service(db: Session = Depends(get_db)) -> TodayService:
    return TodayService(TodayRepository(db))
