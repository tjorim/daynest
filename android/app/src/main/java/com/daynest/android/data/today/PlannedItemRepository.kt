package com.daynest.android.data.today

import android.content.Context
import com.daynest.android.core.database.sync.CacheEntryDao
import com.daynest.android.core.database.sync.CacheEntryEntity
import com.daynest.android.core.database.sync.PendingMutationDao
import com.daynest.android.core.database.sync.PendingMutationEntity
import com.daynest.android.core.network.JsonSerializer
import com.daynest.android.data.safeApiCall
import com.daynest.android.data.sync.CreatePlannedPayload
import com.daynest.android.data.sync.DaynestSyncScheduler
import com.daynest.android.data.sync.DeletePlannedPayload
import com.daynest.android.data.sync.PendingMutationKind
import com.daynest.android.data.sync.SyncCacheKeys
import com.daynest.android.data.sync.UpdatePlannedPayload
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.encodeToString
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.random.Random

@Singleton
class PlannedItemRepository
    @Inject
    constructor(
        private val plannedItemApi: PlannedItemApi,
        private val cacheEntryDao: CacheEntryDao,
        private val pendingMutationDao: PendingMutationDao,
        @ApplicationContext private val appContext: Context? = null,
    ) {
        suspend fun markPlannedDone(
            id: Int,
            item: PlannedTodayItemDto,
            isDone: Boolean,
            scope: EditScope = EditScope.THIS,
        ): Result<PlannedTodayItemDto> =
            updatePlannedItem(
                id,
                PlannedItemUpdateDto(
                    title = item.title,
                    plannedFor = item.plannedFor,
                    isDone = isDone,
                    timeOfDay = item.timeOfDay,
                    durationMinutes = item.durationMinutes,
                    notes = item.notes,
                    moduleKey = item.moduleKey,
                    rrule = item.rrule,
                    recurrenceHint = item.recurrenceHint,
                    linkedSource = item.linkedSource,
                    linkedRef = item.linkedRef,
                    priority = item.priority,
                    tags = item.tags,
                ),
                scope,
            )

        suspend fun updatePlannedItem(
            id: Int,
            input: PlannedItemUpdateDto,
            scope: EditScope = EditScope.THIS,
        ): Result<PlannedTodayItemDto> =
            safeApiCall {
                plannedItemApi.updatePlannedItem(id, input, scope).also { scheduleSync() }
            }.recoverOffline {
                enqueue(
                    kind = PendingMutationKind.UPDATE_PLANNED,
                    payload = UpdatePlannedPayload(id, input, scope),
                )
                scheduleSync()
                PlannedTodayItemDto(
                    id = id,
                    title = input.title,
                    plannedFor = input.plannedFor,
                    isDone = input.isDone,
                    timeOfDay = input.timeOfDay,
                    durationMinutes = input.durationMinutes,
                    notes = input.notes,
                    moduleKey = input.moduleKey,
                    rrule = input.rrule,
                    recurrenceHint = input.recurrenceHint,
                    linkedSource = input.linkedSource,
                    linkedRef = input.linkedRef,
                    priority = input.priority,
                    tags = input.tags,
                )
            }

        suspend fun deletePlannedItem(
            id: Int,
            scope: DeleteScope = DeleteScope.THIS,
        ): Result<Unit> =
            safeApiCall {
                plannedItemApi.deletePlannedItem(id, scope).also { scheduleSync() }
            }.recoverOffline {
                enqueue(
                    kind = PendingMutationKind.DELETE_PLANNED,
                    payload = DeletePlannedPayload(id, scope),
                )
                scheduleSync()
                Unit
            }

        suspend fun createPlannedItem(request: PlannedItemCreateDto): Result<PlannedTodayItemDto> =
            safeApiCall {
                plannedItemApi.createPlannedItem(request).also { scheduleSync() }
            }.recoverOffline {
                enqueue(
                    kind = PendingMutationKind.CREATE_PLANNED,
                    payload = CreatePlannedPayload(request),
                )
                scheduleSync()
                PlannedTodayItemDto(
                    id = -Random.nextInt(1, Int.MAX_VALUE),
                    title = request.title,
                    isDone = false,
                    plannedFor = request.plannedFor,
                    timeOfDay = request.timeOfDay,
                    durationMinutes = request.durationMinutes,
                    notes = request.notes,
                    moduleKey = request.moduleKey,
                    rrule = request.rrule,
                    recurrenceHint = request.recurrenceHint,
                    linkedSource = request.linkedSource,
                    linkedRef = request.linkedRef,
                    priority = request.priority,
                    tags = request.tags,
                )
            }

        suspend fun listPlannedItems(
            startDate: String?,
            endDate: String?,
        ): Result<List<PlannedTodayItemDto>> {
            val cacheKey = plannedItemsCacheKey(startDate, endDate)
            return safeApiCall { plannedItemApi.listPlannedItems(startDate, endDate) }
                .onSuccess { items ->
                    cacheEntryDao.upsert(
                        CacheEntryEntity(
                            cacheKey = cacheKey,
                            payload =
                                JsonSerializer.config.encodeToString(
                                    ListSerializer(PlannedTodayItemDto.serializer()),
                                    items,
                                ),
                            updatedAtEpochMillis = System.currentTimeMillis(),
                        ),
                    )
                }.recoverOffline {
                    cacheEntryDao.get(cacheKey)?.payload?.let { payload ->
                        JsonSerializer.config.decodeFromString(
                            ListSerializer(PlannedTodayItemDto.serializer()),
                            payload,
                        )
                    } ?: emptyList()
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

        private fun scheduleSync() {
            appContext?.let { DaynestSyncScheduler.enqueueOneShot(it) }
        }

        private suspend inline fun <T> Result<T>.recoverOffline(crossinline fallback: suspend () -> T): Result<T> {
            if (isSuccess) return this
            val failure = exceptionOrNull()
            return if (failure is IOException) {
                runCatching { fallback() }
            } else {
                this
            }
        }

        private fun plannedItemsCacheKey(
            startDate: String?,
            endDate: String?,
        ): String = "${SyncCacheKeys.PLANNED_ITEMS}:${startDate.orEmpty()}:${endDate.orEmpty()}"
    }
