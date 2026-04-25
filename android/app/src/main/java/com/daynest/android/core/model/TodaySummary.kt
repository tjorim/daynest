package com.daynest.android.core.model

data class TodaySummary(
    val routinesCount: Int,
    val choresCount: Int,
    val medicationsCount: Int,
    val plannedPendingCount: Int,
)

fun TodaySummary.toTodoSummaryUiModel(): TodoSummaryUiModel {
    val remaining = routinesCount + choresCount + plannedPendingCount + medicationsCount

    return TodoSummaryUiModel(
        greeting = "Welcome to Daynest",
        subtitle = "You have $remaining items to handle today.",
        primaryActionLabel = if (remaining == 0) "You're all caught up" else "Plan today",
    )
}
