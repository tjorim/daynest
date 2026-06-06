package com.daynest.android.data.sync

import com.daynest.android.data.shopping.ShoppingListCreateDto
import com.daynest.android.data.shopping.ShoppingListUpdateDto
import com.daynest.android.data.today.DeleteScope
import com.daynest.android.data.today.EditScope
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
    val scope: EditScope = EditScope.THIS,
)

@Serializable
data class DeletePlannedPayload(
    val id: Int,
    val scope: DeleteScope = DeleteScope.THIS,
)

@Serializable
data class CreatePlannedPayload(
    val request: PlannedItemCreateDto,
)

@Serializable
data class CreateShoppingListPayload(
    val request: ShoppingListCreateDto,
)

@Serializable
data class UpdateShoppingListPayload(
    val id: Int,
    val request: ShoppingListUpdateDto,
)

@Serializable
data class DeleteShoppingListPayload(
    val id: Int,
)
