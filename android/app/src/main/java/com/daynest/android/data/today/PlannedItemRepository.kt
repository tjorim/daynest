package com.daynest.android.data.today

import com.daynest.android.data.safeApiCall
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PlannedItemRepository
    @Inject
    constructor(
        private val plannedItemApi: PlannedItemApi,
    ) {
        suspend fun markPlannedDone(
            id: Int,
            item: PlannedTodayItemDto,
            isDone: Boolean,
        ): Result<PlannedTodayItemDto> =
            safeApiCall {
                plannedItemApi.updatePlannedItem(
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
            }

        suspend fun updatePlannedItem(
            id: Int,
            input: PlannedItemUpdateDto,
        ): Result<PlannedTodayItemDto> = safeApiCall { plannedItemApi.updatePlannedItem(id, input) }

        suspend fun deletePlannedItem(id: Int): Result<Unit> = safeApiCall { plannedItemApi.deletePlannedItem(id) }

        suspend fun createPlannedItem(request: PlannedItemCreateDto): Result<PlannedTodayItemDto> =
            safeApiCall { plannedItemApi.createPlannedItem(request) }

        suspend fun listPlannedItems(
            startDate: String?,
            endDate: String?,
        ): Result<List<PlannedTodayItemDto>> = safeApiCall { plannedItemApi.listPlannedItems(startDate, endDate) }
    }
