from datetime import date
from typing import Literal

from pydantic import BaseModel


class DailyCount(BaseModel):
    date: date
    completed: int
    total: int
    completion_rate: float


class ChoreStreak(BaseModel):
    chore_id: int
    name: str
    current_streak: int
    longest_streak: int


class SkippedChore(BaseModel):
    chore_id: int
    name: str
    skip_count: int


class ChoreStats(BaseModel):
    completion_rate: float
    total_completed: int
    total_scheduled: int
    daily_completions: list[DailyCount]
    streaks: list[ChoreStreak]
    most_skipped: list[SkippedChore]


class DailyAdherence(BaseModel):
    date: date
    taken: int
    total: int
    adherence_rate: float


class MedicationStats(BaseModel):
    adherence_rate: float
    total_taken: int
    total_scheduled: int
    daily_adherence: list[DailyAdherence]


class PlannedItemStats(BaseModel):
    completion_rate: float
    total_completed: int
    total_scheduled: int
    daily_completions: list[DailyCount]


class RoutineStreak(BaseModel):
    routine_id: int
    name: str
    current_streak: int
    longest_streak: int


class RoutineStats(BaseModel):
    completion_rate: float
    total_completed: int
    total_scheduled: int
    daily_completions: list[DailyCount]
    streaks: list[RoutineStreak]


class AnalyticsSummaryResponse(BaseModel):
    period: Literal["week", "month", "year"]
    start_date: date
    end_date: date
    chores: ChoreStats
    medications: MedicationStats
    planned_items: PlannedItemStats
    routines: RoutineStats
