package com.daynest.android.core.model

data class TodaySummary(
    val routinesCount: Int,
    val choresCount: Int,
    val medicationsCount: Int,
    val plannedPendingCount: Int,
) {
    val remainingCount: Int
        get() = routinesCount + choresCount + medicationsCount + plannedPendingCount

    val isCaughtUp: Boolean
        get() = remainingCount == 0
}
