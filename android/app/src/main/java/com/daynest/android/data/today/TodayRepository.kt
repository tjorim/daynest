package com.daynest.android.data.today

import com.daynest.android.core.database.today.TodaySummaryDao
import com.daynest.android.core.database.today.TodaySummaryEntity
import com.daynest.android.core.model.TodaySummary
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
@Suppress("TooManyFunctions")
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
                todayResponseFlow.value = today
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

        @Suppress("TooGenericExceptionCaught")
        suspend fun completeChore(choreInstanceId: Int): Result<ChoreMutationDto> =
            runCatching { todayActionsApi.completeChore(choreInstanceId) }

        @Suppress("TooGenericExceptionCaught", "ktlint:standard:function-signature")
        suspend fun skipChore(choreInstanceId: Int): Result<ChoreMutationDto> =
            runCatching { todayActionsApi.skipChore(choreInstanceId) }

        @Suppress("TooGenericExceptionCaught")
        suspend fun completeTask(taskInstanceId: Int): Result<TaskMutationDto> =
            runCatching { todayActionsApi.completeTask(taskInstanceId) }

        @Suppress("TooGenericExceptionCaught", "ktlint:standard:function-signature")
        suspend fun skipTask(taskInstanceId: Int): Result<TaskMutationDto> =
            runCatching { todayActionsApi.skipTask(taskInstanceId) }

        @Suppress("TooGenericExceptionCaught", "ktlint:standard:function-signature")
        suspend fun takeDose(doseInstanceId: Int): Result<DoseMutationDto> =
            runCatching { todayActionsApi.takeDose(doseInstanceId) }

        @Suppress("TooGenericExceptionCaught", "ktlint:standard:function-signature")
        suspend fun skipDose(doseInstanceId: Int): Result<DoseMutationDto> =
            runCatching { todayActionsApi.skipDose(doseInstanceId) }

        @Suppress("TooGenericExceptionCaught")
        suspend fun markPlannedDone(
            id: Int,
            item: PlannedTodayItemDto,
            isDone: Boolean,
        ): Result<PlannedTodayItemDto> =
            runCatching {
                todayActionsApi.updatePlannedItem(
                    id,
                    PlannedItemUpdateDto(
                        title = item.title,
                        plannedFor = item.plannedFor,
                        isDone = isDone,
                        notes = item.notes,
                        moduleKey = item.moduleKey,
                        recurrenceHint = item.recurrenceHint,
                    ),
                )
            }

        @Suppress("TooGenericExceptionCaught")
        suspend fun deletePlannedItem(id: Int): Result<Unit> = runCatching { todayActionsApi.deletePlannedItem(id) }

        @Suppress("TooGenericExceptionCaught")
        suspend fun createPlannedItem(request: PlannedItemCreateDto): Result<PlannedTodayItemDto> =
            runCatching { todayActionsApi.createPlannedItem(request) }

        private fun TodaySummaryEntity.toDomain() =
            TodaySummary(
                routinesCount = routinesCount,
                choresCount = choresCount,
                medicationsCount = medicationsCount,
                plannedPendingCount = plannedPendingCount,
            )
    }
