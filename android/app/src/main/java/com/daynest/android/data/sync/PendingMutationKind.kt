package com.daynest.android.data.sync

enum class PendingMutationKind {
    COMPLETE_CHORE,
    SKIP_CHORE,
    RESCHEDULE_CHORE,
    COMPLETE_TASK,
    START_TASK,
    SKIP_TASK,
    TAKE_DOSE,
    SKIP_DOSE,
    UPDATE_PLANNED,
    DELETE_PLANNED,
    CREATE_PLANNED,
}
