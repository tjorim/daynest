package com.daynest.android.data.sync

import com.daynest.android.data.today.PlannedItemCreateDto
import com.daynest.android.data.today.PlannedItemUpdateDto
import kotlinx.serialization.Serializable

@Serializable
data class MutationIdPayload(
    val id: Int,
)

@Serializable
data class ReschedulePayload(
    val id: Int,
    val scheduledDate: String,
)

@Serializable
data class UpdatePlannedPayload(
    val id: Int,
    val request: PlannedItemUpdateDto,
)

@Serializable
data class DeletePlannedPayload(
    val id: Int,
)

@Serializable
data class CreatePlannedPayload(
    val request: PlannedItemCreateDto,
)
