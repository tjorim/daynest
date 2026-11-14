from datetime import date
from typing import Literal

from pydantic import Field

from app.schemas.base import ResponseModel


class DailyCount(ResponseModel):
    date: date
    completed: int
    total: int
    completion_rate: float


class ChoreStreak(ResponseModel):
    chore_id: int
    name: str
    current_streak: int
    longest_streak: int


class SkippedChore(ResponseModel):
    chore_id: int
    name: str
    skip_count: int


class ChoreStats(ResponseModel):
    completion_rate: float
    total_completed: int
    total_scheduled: int
    daily_completions: list[DailyCount]
    streaks: list[ChoreStreak]
    most_skipped: list[SkippedChore]


class DailyAdherence(ResponseModel):
    date: date
    taken: int
    total: int
    adherence_rate: float


class MedicationStats(ResponseModel):
    adherence_rate: float
    total_taken: int
    total_scheduled: int
    daily_adherence: list[DailyAdherence]


class PlannedItemStats(ResponseModel):
    completion_rate: float
    total_completed: int
    total_scheduled: int
    daily_completions: list[DailyCount]


class RoutineStreak(ResponseModel):
    routine_id: int
    name: str
    current_streak: int
    longest_streak: int


class RoutineStats(ResponseModel):
    completion_rate: float
    total_completed: int
    total_scheduled: int
    daily_completions: list[DailyCount]
    streaks: list[RoutineStreak]


class AnalyticsSummaryResponse(ResponseModel):
    period: Literal["week", "month", "year"]
    start_date: date
    end_date: date
    chores: ChoreStats
    medications: MedicationStats
    planned_items: PlannedItemStats
    routines: RoutineStats


SuggestionType = Literal["chore_reschedule", "medication_reminder_adjustment", "load_balancing"]
SuggestionValue = str | int | float | bool | None


class SchedulingSuggestion(ResponseModel):
    suggestion_type: SuggestionType
    message: str
    metadata: dict[str, SuggestionValue] = Field(default_factory=dict)


class SchedulingSuggestionsResponse(ResponseModel):
    for_date: date
    suggestions: list[SchedulingSuggestion]
