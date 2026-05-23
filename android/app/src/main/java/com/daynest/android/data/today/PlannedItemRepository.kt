package com.daynest.android.data.today

import android.content.Context
import com.daynest.android.core.database.sync.CacheEntryDao
import com.daynest.android.core.database.sync.CacheEntryEntity
import com.daynest.android.core.database.sync.PendingMutationDao
import com.daynest.android.core.database.sync.PendingMutationEntity
import com.daynest.android.core.network.JsonSerializer
import com.daynest.android.data.sync.CreatePlannedPayload
import com.daynest.android.data.sync.DaynestSyncScheduler
import com.daynest.android.data.sync.DeletePlannedPayload
import com.daynest.android.data.sync.PendingMutationKind
import com.daynest.android.data.sync.SyncCacheKeys
import com.daynest.android.data.sync.UpdatePlannedPayload
import com.daynest.android.data.safeApiCall
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.IOException
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.encodeToString
import kotlin.math.absoluteValue
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PlannedItemRepository
    @Inject
    constructor(
        private val plannedItemApi: PlannedItemApi,
        private val cacheEntryDao: CacheEntryDao,
        private val pendingMutationDao: PendingMutationDao,
        @ApplicationContext private val appContext: Context,
    ) {
        suspend fun markPlannedDone(
            id: Int,
            item: PlannedTodayItemDto,
            isDone: Boolean,
        ): Result<PlannedTodayItemDto> =
                updatePlannedItem(
                    id,
                    PlannedItemUpdateDto(
                        title = item.title,
                        plannedFor = item.plannedFor,
                        isDone = isDone,
                        notes = item.notes,
                        moduleKey = item.moduleKey,
                        recurrenceHint = item.recurrenceHint,
                        linkedSource = item.linkedSource,
                        linkedRef = item.linkedRef,
                    ),
                )

        suspend fun updatePlannedItem(
            id: Int,
            input: PlannedItemUpdateDto,
        ): Result<PlannedTodayItemDto> =
                safeApiCall { plannedItemApi.updatePlannedItem(id, input) }.recoverCatchingOffline {
                    enqueue(
                        kind = PendingMutationKind.UPDATE_PLANNED,
                        payload = UpdatePlannedPayload(id, input),
                    )
                DaynestSyncScheduler.enqueueOneShot(appContext)
                PlannedTodayItemDto(
                    id = id,
                    title = input.title,
                    plannedFor = input.plannedFor,
                    isDone = input.isDone,
                    notes = input.notes,
                    moduleKey = input.moduleKey,
                    recurrenceHint = input.recurrenceHint,
                    linkedSource = input.linkedSource,
                    linkedRef = input.linkedRef,
                )
            }

        suspend fun deletePlannedItem(id: Int): Result<Unit> =
            safeApiCall { plannedItemApi.deletePlannedItem(id) }.recoverCatchingOffline {
                enqueue(
                    kind = PendingMutationKind.DELETE_PLANNED,
                    payload = DeletePlannedPayload(id),
                )
                DaynestSyncScheduler.enqueueOneShot(appContext)
                Unit
            }

        suspend fun createPlannedItem(request: PlannedItemCreateDto): Result<PlannedTodayItemDto> =
            safeApiCall { plannedItemApi.createPlannedItem(request) }.recoverCatchingOffline {
                enqueue(
                    kind = PendingMutationKind.CREATE_PLANNED,
                    payload = CreatePlannedPayload(request),
                )
                DaynestSyncScheduler.enqueueOneShot(appContext)
                PlannedTodayItemDto(
                    id = -System.currentTimeMillis().toInt().absoluteValue,
                    title = request.title,
                    isDone = false,
                    plannedFor = request.plannedFor,
                    notes = request.notes,
                    moduleKey = request.moduleKey,
                    recurrenceHint = request.recurrenceHint,
                    linkedSource = request.linkedSource,
                    linkedRef = request.linkedRef,
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
                }.recoverCatchingOffline {
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

        private suspend inline fun <T> Result<T>.recoverCatchingOffline(
            crossinline fallback: suspend () -> T,
        ): Result<T> {
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
