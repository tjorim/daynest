package com.daynest.android.data.today

import com.daynest.android.core.database.today.TodaySummaryDao
import com.daynest.android.core.database.today.TodaySummaryEntity
import com.daynest.android.core.model.TodaySummary
import com.daynest.android.data.safeApiCall
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TodayRepository
    @Inject
    constructor(
        private val todayApi: TodayApi,
        private val todayActionsApi: TodayActionsApi,
        private val todaySummaryDao: TodaySummaryDao,
    ) {
        private val todayResponseFlow = MutableStateFlow<TodayResponseDto?>(null)

        fun observeTodaySummary(): Flow<TodaySummary?> = todaySummaryDao.observe().map { entity -> entity?.toDomain() }

        fun observeTodayResponse(): Flow<TodayResponseDto?> = todayResponseFlow.asStateFlow()

        @Suppress("TooGenericExceptionCaught")
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
                todayResponseFlow.value = today
                Result.success(Unit)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                Result.failure(e)
            }

        suspend fun completeChore(choreInstanceId: Int): Result<ChoreMutationDto> =
            safeApiCall { todayActionsApi.completeChore(choreInstanceId) }

        @Suppress("ktlint:standard:function-signature")
        suspend fun skipChore(choreInstanceId: Int): Result<ChoreMutationDto> =
            safeApiCall { todayActionsApi.skipChore(choreInstanceId) }

        @Suppress("ktlint:standard:function-signature")
        suspend fun rescheduleChore(
            choreInstanceId: Int,
            scheduledDate: String,
        ): Result<ChoreMutationDto> =
            safeApiCall {
                todayActionsApi.rescheduleChore(choreInstanceId, RescheduleChoreDto(scheduledDate = scheduledDate))
            }

        suspend fun completeTask(taskInstanceId: Int): Result<TaskMutationDto> =
            safeApiCall { todayActionsApi.completeTask(taskInstanceId) }

        @Suppress("ktlint:standard:function-signature")
        suspend fun startTask(taskInstanceId: Int): Result<TaskMutationDto> =
            safeApiCall { todayActionsApi.startTask(taskInstanceId) }

        @Suppress("ktlint:standard:function-signature")
        suspend fun skipTask(taskInstanceId: Int): Result<TaskMutationDto> =
            safeApiCall { todayActionsApi.skipTask(taskInstanceId) }

        @Suppress("ktlint:standard:function-signature")
        suspend fun takeDose(doseInstanceId: Int): Result<DoseMutationDto> =
            safeApiCall { todayActionsApi.takeDose(doseInstanceId) }

        @Suppress("ktlint:standard:function-signature")
        suspend fun skipDose(doseInstanceId: Int): Result<DoseMutationDto> =
            safeApiCall { todayActionsApi.skipDose(doseInstanceId) }
    }

private fun TodaySummaryEntity.toDomain() =
    TodaySummary(
        routinesCount = routinesCount,
        choresCount = choresCount,
        medicationsCount = medicationsCount,
        plannedPendingCount = plannedPendingCount,
    )
