package com.daynest.android.data.today

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import com.daynest.android.core.database.sync.CacheEntryDao
import com.daynest.android.core.database.sync.CacheEntryEntity
import com.daynest.android.core.database.sync.PendingMutationDao
import com.daynest.android.core.database.sync.PendingMutationEntity
import com.daynest.android.core.database.today.TodaySummaryDao
import com.daynest.android.core.database.today.TodaySummaryEntity
import com.daynest.android.core.model.TodaySummary
import com.daynest.android.core.network.JsonSerializer
import com.daynest.android.data.sync.DaynestSyncScheduler
import com.daynest.android.data.sync.MutationIdPayload
import com.daynest.android.data.sync.PendingMutationKind
import com.daynest.android.data.sync.ReschedulePayload
import com.daynest.android.data.sync.SyncCacheKeys
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.io.IOException
import kotlinx.serialization.encodeToString
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TodayRepository
    @Inject
    constructor(
        private val todayApi: TodayApi,
        private val todayActionsApi: TodayActionsApi,
        private val todaySummaryDao: TodaySummaryDao,
        private val cacheEntryDao: CacheEntryDao,
        private val pendingMutationDao: PendingMutationDao,
        @ApplicationContext private val appContext: Context? = null,
    ) {
        fun observePendingMutationCount(): Flow<Int> = pendingMutationDao.observeCount()

        fun observeTodaySummary(): Flow<TodaySummary?> = todaySummaryDao.observe().map { entity -> entity?.toDomain() }

        fun observeTodayResponse(): Flow<TodayResponseDto?> =
            cacheEntryDao.observe(SyncCacheKeys.TODAY).map { entry ->
                entry?.payload?.let { payload ->
                    runCatching { JsonSerializer.config.decodeFromString(TodayResponseDto.serializer(), payload) }.getOrNull()
                }
            }

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
                cacheEntryDao.upsert(
                    CacheEntryEntity(
                        cacheKey = SyncCacheKeys.TODAY,
                        payload = JsonSerializer.config.encodeToString(TodayResponseDto.serializer(), today),
                        updatedAtEpochMillis = entity.lastFetchedEpochMillis,
                    ),
                )
                Result.success(Unit)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                Result.failure(e)
            }

        suspend fun completeChore(choreInstanceId: Int): Result<ChoreMutationDto> =
            mutateWithOfflineFallback(
                kind = PendingMutationKind.COMPLETE_CHORE,
                payload = MutationIdPayload(choreInstanceId),
                fallback = { ChoreMutationDto(choreInstanceId, "queued") },
            ) { todayActionsApi.completeChore(choreInstanceId) }

        @Suppress("ktlint:standard:function-signature")
        suspend fun skipChore(choreInstanceId: Int): Result<ChoreMutationDto> =
            mutateWithOfflineFallback(
                kind = PendingMutationKind.SKIP_CHORE,
                payload = MutationIdPayload(choreInstanceId),
                fallback = { ChoreMutationDto(choreInstanceId, "queued") },
            ) { todayActionsApi.skipChore(choreInstanceId) }

        @Suppress("ktlint:standard:function-signature")
        suspend fun rescheduleChore(
            choreInstanceId: Int,
            scheduledDate: String,
        ): Result<ChoreMutationDto> =
            mutateWithOfflineFallback(
                kind = PendingMutationKind.RESCHEDULE_CHORE,
                payload = ReschedulePayload(choreInstanceId, scheduledDate),
                fallback = { ChoreMutationDto(choreInstanceId, "queued") },
            ) {
                todayActionsApi.rescheduleChore(choreInstanceId, RescheduleChoreDto(scheduledDate = scheduledDate))
            }

        suspend fun completeTask(taskInstanceId: Int): Result<TaskMutationDto> =
            mutateWithOfflineFallback(
                kind = PendingMutationKind.COMPLETE_TASK,
                payload = MutationIdPayload(taskInstanceId),
                fallback = { TaskMutationDto(taskInstanceId, "queued") },
            ) { todayActionsApi.completeTask(taskInstanceId) }

        @Suppress("ktlint:standard:function-signature")
        suspend fun startTask(taskInstanceId: Int): Result<TaskMutationDto> =
            mutateWithOfflineFallback(
                kind = PendingMutationKind.START_TASK,
                payload = MutationIdPayload(taskInstanceId),
                fallback = { TaskMutationDto(taskInstanceId, "queued") },
            ) { todayActionsApi.startTask(taskInstanceId) }

        @Suppress("ktlint:standard:function-signature")
        suspend fun skipTask(taskInstanceId: Int): Result<TaskMutationDto> =
            mutateWithOfflineFallback(
                kind = PendingMutationKind.SKIP_TASK,
                payload = MutationIdPayload(taskInstanceId),
                fallback = { TaskMutationDto(taskInstanceId, "queued") },
            ) { todayActionsApi.skipTask(taskInstanceId) }

        @Suppress("ktlint:standard:function-signature")
        suspend fun takeDose(doseInstanceId: Int): Result<DoseMutationDto> =
            mutateWithOfflineFallback(
                kind = PendingMutationKind.TAKE_DOSE,
                payload = MutationIdPayload(doseInstanceId),
                fallback = { DoseMutationDto(doseInstanceId, "queued") },
            ) { todayActionsApi.takeDose(doseInstanceId) }

        @Suppress("ktlint:standard:function-signature")
        suspend fun skipDose(doseInstanceId: Int): Result<DoseMutationDto> =
            mutateWithOfflineFallback(
                kind = PendingMutationKind.SKIP_DOSE,
                payload = MutationIdPayload(doseInstanceId),
                fallback = { DoseMutationDto(doseInstanceId, "queued") },
            ) { todayActionsApi.skipDose(doseInstanceId) }

        private suspend inline fun <reified T : Any> mutateWithOfflineFallback(
            kind: PendingMutationKind,
            payload: T,
            fallback: () -> T,
            crossinline call: suspend () -> T,
        ): Result<T> =
            try {
                Result.success(call())
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                if (isOfflineError(e)) {
                    enqueue(kind, payload)
                    appContext?.let { context ->
                        runCatching { DaynestSyncScheduler.enqueueOneShot(context) }
                    }
                    Result.success(fallback())
                } else {
                    Result.failure(e)
                }
            }

        private suspend inline fun <reified T : Any> enqueue(
            kind: PendingMutationKind,
            payload: T,
        ) {
            pendingMutationDao.enqueue(
                PendingMutationEntity(
                    kind = kind.name,
                    payload = JsonSerializer.config.encodeToString(payload),
                    createdAtEpochMillis = System.currentTimeMillis(),
                ),
            )
        }

        private fun isOfflineError(error: Throwable): Boolean = error is IOException
    }

private fun TodaySummaryEntity.toDomain() =
    TodaySummary(
        routinesCount = routinesCount,
        choresCount = choresCount,
        medicationsCount = medicationsCount,
        plannedPendingCount = plannedPendingCount,
    )
