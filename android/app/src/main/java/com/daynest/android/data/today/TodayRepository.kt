package com.daynest.android.data.today

import com.daynest.android.core.database.today.TodaySummaryDao
import com.daynest.android.core.database.today.TodaySummaryEntity
import com.daynest.android.core.model.TodaySummary
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TodayRepository
    @Inject
    constructor(
        private val todayApi: TodayApi,
        private val todaySummaryDao: TodaySummaryDao,
    ) {
        fun observeTodaySummary(): Flow<TodaySummary?> =
            todaySummaryDao.observe().map { entity -> entity?.toDomain() }

        suspend fun refresh(): Result<Unit> =
            try {
                val today = todayApi.getToday()
                val entity =
                    TodaySummaryEntity(
                        id = 0,
                        routinesCount = today.routines.size,
                        choresCount = today.dueToday.size + today.overdue.size,
                        medicationsCount = today.medication.size,
                        plannedPendingCount = today.planned.count { !it.isDone },
                        lastFetchedEpochMillis = System.currentTimeMillis(),
                    )
                todaySummaryDao.upsert(entity)
                Result.success(Unit)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                Result.failure(e)
            }

        private fun TodaySummaryEntity.toDomain() =
            TodaySummary(
                routinesCount = routinesCount,
                choresCount = choresCount,
                medicationsCount = medicationsCount,
                plannedPendingCount = plannedPendingCount,
            )
    }
