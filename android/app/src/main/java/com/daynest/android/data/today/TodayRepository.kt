package com.daynest.android.data.today

import android.content.Context
import com.daynest.android.core.database.sync.CacheEntryDao
import com.daynest.android.core.database.sync.CacheEntryEntity
import com.daynest.android.core.database.sync.PendingMutationDao
import com.daynest.android.core.database.sync.PendingMutationEntity
import com.daynest.android.core.database.sync.SyncNoticeDao
import com.daynest.android.core.database.sync.SyncNoticeEntity
import com.daynest.android.core.database.today.TodaySummaryDao
import com.daynest.android.core.database.today.TodaySummaryEntity
import com.daynest.android.core.model.TodaySummary
import com.daynest.android.core.network.JsonSerializer
import com.daynest.android.data.sync.DaynestSyncScheduler
import com.daynest.android.data.sync.MutationIdPayload
import com.daynest.android.data.sync.PendingMutationKind
import com.daynest.android.data.sync.ReschedulePayload
import com.daynest.android.data.sync.SyncCacheKeys
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.serialization.encodeToString

@Singleton
class TodayRepository
@Inject
constructor(
    private val todayApi: TodayApi,
    private val todayActionsApi: TodayActionsApi,
    private val todaySummaryDao: TodaySummaryDao,
    private val cacheEntryDao: CacheEntryDao,
    private val pendingMutationDao: PendingMutationDao,
    private val syncNoticeDao: SyncNoticeDao = NoopSyncNoticeDao,
    @ApplicationContext private val appContext: Context? = null
) {
    fun observePendingMutationCount(): Flow<Int> = pendingMutationDao.observeCount()

    fun observeSyncNotices(): Flow<List<SyncNoticeEntity>> = syncNoticeDao.observeUnconsumed()

    suspend fun markSyncNoticeConsumed(id: Long) {
        syncNoticeDao.markConsumed(id, System.currentTimeMillis())
    }

    fun observeTodaySummary(): Flow<TodaySummary?> = todaySummaryDao.observe().map { entity -> entity?.toDomain() }

    fun observeTodayResponse(): Flow<TodayResponseDto?> = cacheEntryDao.observe(SyncCacheKeys.TODAY).map { entry ->
        entry?.payload?.let { payload ->
            runCatching {
                JsonSerializer.config.decodeFromString(TodayResponseDto.serializer(), payload)
            }.getOrNull()
        }
    }

    suspend fun getCachedTodayResponse(): TodayResponseDto? {
        val entry = cacheEntryDao.get(SyncCacheKeys.TODAY) ?: return null
        return runCatching {
            JsonSerializer.config.decodeFromString(TodayResponseDto.serializer(), entry.payload)
        }.getOrNull()
    }

    suspend fun refresh(): Result<Unit> = try {
        val today = todayApi.getToday()
        val entity =
            TodaySummaryEntity(
                id = 0,
                routinesCount = today.routines.size,
                choresCount = today.dueToday.size + today.overdue.size,
                medicationsCount = today.medication.size,
                plannedPendingCount = today.planned.count { !it.isDone },
                lastFetchedEpochMillis = System.currentTimeMillis()
            )
        todaySummaryDao.upsert(entity)
        cacheEntryDao.upsert(
            CacheEntryEntity(
                cacheKey = SyncCacheKeys.TODAY,
                payload = JsonSerializer.config.encodeToString(TodayResponseDto.serializer(), today),
                updatedAtEpochMillis = entity.lastFetchedEpochMillis
            )
        )
        Result.success(Unit)
    } catch (e: CancellationException) {
        throw e
    } catch (e: IOException) {
        Result.failure(e)
    } catch (e: IllegalStateException) {
        Result.failure(e)
    }

    val completeChore: suspend (Int) -> Result<ChoreMutationDto> = { choreInstanceId ->
        mutateWithOfflineFallback(
            kind = PendingMutationKind.COMPLETE_CHORE,
            payload = MutationIdPayload(choreInstanceId),
            fallback = { ChoreMutationDto(choreInstanceId, "queued") }
        ) { todayActionsApi.completeChore(choreInstanceId) }
    }

    val skipChore: suspend (Int) -> Result<ChoreMutationDto> = { choreInstanceId ->
        mutateWithOfflineFallback(
            kind = PendingMutationKind.SKIP_CHORE,
            payload = MutationIdPayload(choreInstanceId),
            fallback = { ChoreMutationDto(choreInstanceId, "queued") }
        ) { todayActionsApi.skipChore(choreInstanceId) }
    }

    val rescheduleChore: suspend (Int, String) -> Result<ChoreMutationDto> = { choreInstanceId, scheduledDate ->
        mutateWithOfflineFallback(
            kind = PendingMutationKind.RESCHEDULE_CHORE,
            payload = ReschedulePayload(choreInstanceId, scheduledDate),
            fallback = { ChoreMutationDto(choreInstanceId, "queued") }
        ) {
            todayActionsApi.rescheduleChore(choreInstanceId, RescheduleChoreDto(scheduledDate = scheduledDate))
        }
    }

    val completeTask: suspend (Int) -> Result<TaskMutationDto> = { taskInstanceId ->
        mutateWithOfflineFallback(
            kind = PendingMutationKind.COMPLETE_TASK,
            payload = MutationIdPayload(taskInstanceId),
            fallback = { TaskMutationDto(taskInstanceId, "queued") }
        ) { todayActionsApi.completeTask(taskInstanceId) }
    }

    val startTask: suspend (Int) -> Result<TaskMutationDto> = { taskInstanceId ->
        mutateWithOfflineFallback(
            kind = PendingMutationKind.START_TASK,
            payload = MutationIdPayload(taskInstanceId),
            fallback = { TaskMutationDto(taskInstanceId, "queued") }
        ) { todayActionsApi.startTask(taskInstanceId) }
    }

    val skipTask: suspend (Int) -> Result<TaskMutationDto> = { taskInstanceId ->
        mutateWithOfflineFallback(
            kind = PendingMutationKind.SKIP_TASK,
            payload = MutationIdPayload(taskInstanceId),
            fallback = { TaskMutationDto(taskInstanceId, "queued") }
        ) { todayActionsApi.skipTask(taskInstanceId) }
    }

    val takeDose: suspend (Int) -> Result<DoseMutationDto> = { doseInstanceId ->
        mutateWithOfflineFallback(
            kind = PendingMutationKind.TAKE_DOSE,
            payload = MutationIdPayload(doseInstanceId),
            fallback = { DoseMutationDto(doseInstanceId, "queued") }
        ) { todayActionsApi.takeDose(doseInstanceId) }
    }

    val skipDose: suspend (Int) -> Result<DoseMutationDto> = { doseInstanceId ->
        mutateWithOfflineFallback(
            kind = PendingMutationKind.SKIP_DOSE,
            payload = MutationIdPayload(doseInstanceId),
            fallback = { DoseMutationDto(doseInstanceId, "queued") }
        ) { todayActionsApi.skipDose(doseInstanceId) }
    }

    private suspend inline fun <reified P : Any, R : Any> mutateWithOfflineFallback(
        kind: PendingMutationKind,
        payload: P,
        fallback: () -> R,
        crossinline call: suspend () -> R
    ): Result<R> {
        val mutationResult = runCatching { call() }
        mutationResult.onSuccess {
            appContext?.let { context ->
                runCatching { DaynestSyncScheduler.enqueueOneShot(context) }
            }
        }
        return mutationResult.recoverCatching { error ->
            if (error is CancellationException) {
                throw error
            }
            if (error is IOException) {
                enqueue(kind, payload)
                appContext?.let { context ->
                    runCatching { DaynestSyncScheduler.enqueueOneShot(context) }
                }
                fallback()
            } else {
                throw error
            }
        }
    }

    private suspend inline fun <reified T : Any> enqueue(kind: PendingMutationKind, payload: T) {
        pendingMutationDao.enqueue(
            PendingMutationEntity(
                kind = kind.name,
                payload = JsonSerializer.config.encodeToString(payload),
                createdAtEpochMillis = System.currentTimeMillis()
            )
        )
    }
}

private fun TodaySummaryEntity.toDomain() = TodaySummary(
    routinesCount = routinesCount,
    choresCount = choresCount,
    medicationsCount = medicationsCount,
    plannedPendingCount = plannedPendingCount
)

private object NoopSyncNoticeDao : SyncNoticeDao {
    override fun observeUnconsumed(): Flow<List<SyncNoticeEntity>> = flowOf(emptyList())

    override suspend fun insert(entity: SyncNoticeEntity) = Unit

    override suspend fun markConsumed(id: Long, consumedAtEpochMillis: Long) = Unit
}
