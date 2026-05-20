package com.daynest.android.fakes

import com.daynest.android.data.today.ChoreMutationDto
import com.daynest.android.data.today.DoseMutationDto
import com.daynest.android.data.today.RescheduleChoreDto
import com.daynest.android.data.today.TaskMutationDto
import com.daynest.android.data.today.TodayActionsApi

class StubTodayActionsApi : TodayActionsApi {
    override suspend fun completeChore(id: Int): ChoreMutationDto = ChoreMutationDto(id, "completed")

    override suspend fun skipChore(id: Int): ChoreMutationDto = ChoreMutationDto(id, "skipped")

    override suspend fun rescheduleChore(
        id: Int,
        request: RescheduleChoreDto,
    ): ChoreMutationDto = ChoreMutationDto(id, "pending")

    override suspend fun completeTask(id: Int): TaskMutationDto = TaskMutationDto(id, "completed")

    override suspend fun skipTask(id: Int): TaskMutationDto = TaskMutationDto(id, "skipped")

    override suspend fun startTask(id: Int): TaskMutationDto = TaskMutationDto(id, "in_progress")

    override suspend fun takeDose(id: Int): DoseMutationDto = DoseMutationDto(id, "taken")

    override suspend fun skipDose(id: Int): DoseMutationDto = DoseMutationDto(id, "skipped")
}
