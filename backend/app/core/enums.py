import enum


class TaskStatus(str, enum.Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    skipped = "skipped"


class ChoreStatus(str, enum.Enum):
    pending = "pending"
    completed = "completed"
    skipped = "skipped"


class MedicationDoseStatus(str, enum.Enum):
    scheduled = "scheduled"
    taken = "taken"
    skipped = "skipped"
    missed = "missed"
