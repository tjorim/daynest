package com.daynest.android.data.today

import com.daynest.android.core.model.TodaySummary
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TodayRepository @Inject constructor(
    private val todayApi: TodayApi,
) {
    suspend fun getTodaySummary(): TodaySummary {
        val today = todayApi.getToday()

        return TodaySummary(
            routinesCount = today.routines.size,
            choresCount = today.dueToday.size + today.overdue.size,
            medicationsCount = today.medication.size,
            plannedPendingCount = today.planned.count { !it.isDone },
        )
    }
}
