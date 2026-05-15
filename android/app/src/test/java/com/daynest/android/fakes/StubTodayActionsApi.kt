package com.daynest.android.fakes

import com.daynest.android.data.today.ChoreMutationDto
import com.daynest.android.data.today.DoseMutationDto
import com.daynest.android.data.today.PlannedItemCreateDto
import com.daynest.android.data.today.PlannedItemUpdateDto
import com.daynest.android.data.today.PlannedTodayItemDto
import com.daynest.android.data.today.TaskMutationDto
import com.daynest.android.data.today.TodayActionsApi

class StubTodayActionsApi : TodayActionsApi {
    override suspend fun completeChore(id: Int): ChoreMutationDto = ChoreMutationDto(id, "completed")

    override suspend fun skipChore(id: Int): ChoreMutationDto = ChoreMutationDto(id, "skipped")

    override suspend fun completeTask(id: Int): TaskMutationDto = TaskMutationDto(id, "completed")

    override suspend fun skipTask(id: Int): TaskMutationDto = TaskMutationDto(id, "skipped")

    override suspend fun startTask(id: Int): TaskMutationDto = TaskMutationDto(id, "in_progress")

    override suspend fun takeDose(id: Int): DoseMutationDto = DoseMutationDto(id, "taken")

    override suspend fun skipDose(id: Int): DoseMutationDto = DoseMutationDto(id, "skipped")

    override suspend fun updatePlannedItem(
        id: Int,
        request: PlannedItemUpdateDto,
    ): PlannedTodayItemDto = PlannedTodayItemDto(id, request.title, request.isDone)

    override suspend fun deletePlannedItem(id: Int) = Unit

    override suspend fun createPlannedItem(request: PlannedItemCreateDto): PlannedTodayItemDto =
        PlannedTodayItemDto(0, request.title, false)
}
