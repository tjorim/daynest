package com.daynest.android.data.sync

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.daynest.android.R
import com.daynest.android.core.database.sync.CacheEntryDao
import com.daynest.android.core.database.sync.CacheEntryEntity
import com.daynest.android.core.database.sync.PendingMutationDao
import com.daynest.android.core.database.sync.PendingMutationEntity
import com.daynest.android.core.database.sync.SyncNoticeDao
import com.daynest.android.core.database.sync.SyncNoticeEntity
import com.daynest.android.core.database.today.TodaySummaryDao
import com.daynest.android.core.database.today.TodaySummaryEntity
import com.daynest.android.core.network.JsonSerializer
import com.daynest.android.core.storage.preferences.UserPreferencesRepository
import com.daynest.android.data.templates.ChoreTemplateDto
import com.daynest.android.data.templates.RoutineTemplateDto
import com.daynest.android.data.templates.TemplatesApi
import com.daynest.android.data.today.PlannedItemApi
import com.daynest.android.data.today.RescheduleChoreDto
import com.daynest.android.data.today.TodayActionsApi
import com.daynest.android.data.today.TodayApi
import com.daynest.android.data.today.TodayResponseDto
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import kotlinx.coroutines.flow.first
import retrofit2.HttpException

@HiltWorker
class DaynestSyncWorker
    @AssistedInject
    constructor(
        @Assisted appContext: Context,
        @Assisted params: WorkerParameters,
        private val pendingMutationDao: PendingMutationDao,
        private val syncNoticeDao: SyncNoticeDao,
        private val cacheEntryDao: CacheEntryDao,
        private val todaySummaryDao: TodaySummaryDao,
        private val todayApi: TodayApi,
        private val todayActionsApi: TodayActionsApi,
        private val plannedItemApi: PlannedItemApi,
        private val templatesApi: TemplatesApi,
        private val userPreferencesRepository: UserPreferencesRepository,
        private val systemCalendarSyncer: SystemCalendarSyncer,
    ) : CoroutineWorker(appContext, params) {
        override suspend fun doWork(): Result {
            val pending = pendingMutationDao.listAll()
            pending.forEach { mutation ->
                if (mutation.remoteAppliedAtEpochMillis != null) {
                    runCatching { pendingMutationDao.delete(mutation.id) }
                    return@forEach
                }
                val result = runCatching { applyPendingMutation(mutation) }
                if (result.isSuccess) {
                    pendingMutationDao.markRemoteApplied(mutation.id, System.currentTimeMillis())
                    runCatching { pendingMutationDao.delete(mutation.id) }
                } else if (result.exceptionOrNull().isConflict()) {
                    pendingMutationDao.delete(mutation.id)
                    syncNoticeDao.insert(
                        SyncNoticeEntity(
                            message = applicationContext.getString(R.string.sync_notice_conflict_refreshed),
                            createdAtEpochMillis = System.currentTimeMillis(),
                        ),
                    )
                } else {
                    pendingMutationDao.updateAttempts(mutation.id, mutation.attempts + 1)
                }
            }

            return runCatching {
                refreshTodayCache()
                refreshTemplateCaches()
                val prefs = userPreferencesRepository.preferences.first()
                if (prefs.calendarSyncEnabled) {
                    syncCalendarFromCache()
                }
            }.fold(
                onSuccess = { Result.success() },
                onFailure = { Result.retry() },
            )
        }

        private suspend fun refreshTodayCache(): TodayResponseDto {
            val today = todayApi.getToday()
            val now = System.currentTimeMillis()
            cacheEntryDao.upsert(
                CacheEntryEntity(
                    cacheKey = SyncCacheKeys.TODAY,
                    payload = JsonSerializer.config.encodeToString(TodayResponseDto.serializer(), today),
                    updatedAtEpochMillis = now,
                ),
            )
            todaySummaryDao.upsert(
                TodaySummaryEntity(
                    id = 0,
                    routinesCount = today.routines.size,
                    choresCount = today.dueToday.size + today.overdue.size,
                    medicationsCount = today.medication.size,
                    plannedPendingCount = today.planned.count { !it.isDone },
                    lastFetchedEpochMillis = now,
                ),
            )
            return today
        }

        private suspend fun syncCalendarFromCache() {
            val cached = cacheEntryDao.get(SyncCacheKeys.TODAY)?.payload ?: return
            val today = JsonSerializer.config.decodeFromString(TodayResponseDto.serializer(), cached)
            systemCalendarSyncer.sync(today)
        }

        private suspend fun refreshTemplateCaches() {
            upsertTemplateCache(SyncCacheKeys.ROUTINE_TEMPLATES, templatesApi.listRoutines())
            upsertTemplateCache(SyncCacheKeys.CHORE_TEMPLATES, templatesApi.listChores())
        }

        private suspend fun upsertTemplateCache(
            key: String,
            templates: List<*>,
        ) {
            val payload =
                when (key) {
                    SyncCacheKeys.ROUTINE_TEMPLATES ->
                        JsonSerializer.config.encodeToString(
                            kotlinx.serialization.builtins.ListSerializer(RoutineTemplateDto.serializer()),
                            templates.filterIsInstance<RoutineTemplateDto>(),
                        )
                    SyncCacheKeys.CHORE_TEMPLATES ->
                        JsonSerializer.config.encodeToString(
                            kotlinx.serialization.builtins.ListSerializer(ChoreTemplateDto.serializer()),
                            templates.filterIsInstance<ChoreTemplateDto>(),
                        )
                    else -> return
                }
            cacheEntryDao.upsert(
                CacheEntryEntity(
                    cacheKey = key,
                    payload = payload,
                    updatedAtEpochMillis = System.currentTimeMillis(),
                ),
            )
        }

        private suspend fun applyPendingMutation(mutation: PendingMutationEntity) {
            val kind = PendingMutationKind.entries.find { it.name == mutation.kind } ?: return
            when (kind) {
                PendingMutationKind.COMPLETE_CHORE -> {
                    val payload = decode<MutationIdPayload>(mutation.payload)
                    todayActionsApi.completeChore(payload.id)
                }
                PendingMutationKind.SKIP_CHORE -> {
                    val payload = decode<MutationIdPayload>(mutation.payload)
                    todayActionsApi.skipChore(payload.id)
                }
                PendingMutationKind.RESCHEDULE_CHORE -> {
                    val payload = decode<ReschedulePayload>(mutation.payload)
                    todayActionsApi.rescheduleChore(payload.id, RescheduleChoreDto(payload.scheduledDate))
                }
                PendingMutationKind.COMPLETE_TASK -> {
                    val payload = decode<MutationIdPayload>(mutation.payload)
                    todayActionsApi.completeTask(payload.id)
                }
                PendingMutationKind.START_TASK -> {
                    val payload = decode<MutationIdPayload>(mutation.payload)
                    todayActionsApi.startTask(payload.id)
                }
                PendingMutationKind.SKIP_TASK -> {
                    val payload = decode<MutationIdPayload>(mutation.payload)
                    todayActionsApi.skipTask(payload.id)
                }
                PendingMutationKind.TAKE_DOSE -> {
                    val payload = decode<MutationIdPayload>(mutation.payload)
                    todayActionsApi.takeDose(payload.id)
                }
                PendingMutationKind.SKIP_DOSE -> {
                    val payload = decode<MutationIdPayload>(mutation.payload)
                    todayActionsApi.skipDose(payload.id)
                }
                PendingMutationKind.UPDATE_PLANNED -> {
                    val payload = decode<UpdatePlannedPayload>(mutation.payload)
                    plannedItemApi.updatePlannedItem(payload.id, payload.request)
                }
                PendingMutationKind.DELETE_PLANNED -> {
                    val payload = decode<DeletePlannedPayload>(mutation.payload)
                    plannedItemApi.deletePlannedItem(payload.id, payload.scope)
                }
                PendingMutationKind.CREATE_PLANNED -> {
                    val payload = decode<CreatePlannedPayload>(mutation.payload)
                    plannedItemApi.createPlannedItem(payload.request)
                }
            }
        }

        private inline fun <reified T> decode(payload: String): T = JsonSerializer.config.decodeFromString(payload)
    }

private fun Throwable?.isConflict(): Boolean = this is HttpException && code() == HTTP_CONFLICT

private const val HTTP_CONFLICT = 409
