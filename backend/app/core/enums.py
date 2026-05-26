import enum


class Priority(str, enum.Enum):
    low = "low"
    normal = "normal"
    high = "high"
    urgent = "urgent"


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


class PushPlatform(str, enum.Enum):
    fcm = "fcm"
    webpush = "webpush"


class HouseholdMemberRole(str, enum.Enum):
    owner = "owner"
    member = "member"
