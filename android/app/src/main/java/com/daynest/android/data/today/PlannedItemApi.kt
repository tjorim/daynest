package com.daynest.android.data.today

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

interface PlannedItemApi {
    @PUT("api/v1/planned-items/{id}")
    suspend fun updatePlannedItem(
        @Path("id") id: Int,
        @Body request: PlannedItemUpdateDto,
    ): PlannedTodayItemDto

    @DELETE("api/v1/planned-items/{id}")
    suspend fun deletePlannedItem(
        @Path("id") id: Int,
        @Query("scope") scope: DeleteScope = DeleteScope.THIS,
    )

    @POST("api/v1/planned-items")
    suspend fun createPlannedItem(
        @Body request: PlannedItemCreateDto,
    ): PlannedTodayItemDto

    @GET("api/v1/planned-items")
    suspend fun listPlannedItems(
        @Query("start_date") startDate: String?,
        @Query("end_date") endDate: String?,
    ): List<PlannedTodayItemDto>
}

@Serializable
data class PlannedItemUpdateDto(
    val title: String,
    @SerialName("planned_for")
    val plannedFor: String,
    @SerialName("is_done")
    val isDone: Boolean,
    val notes: String? = null,
    @SerialName("module_key")
    val moduleKey: String? = null,
    val rrule: String? = null,
    @SerialName("recurrence_hint")
    val recurrenceHint: String? = null,
    @SerialName("linked_source")
    val linkedSource: String? = null,
    @SerialName("linked_ref")
    val linkedRef: String? = null,
)

@Serializable
data class PlannedItemCreateDto(
    val title: String,
    @SerialName("planned_for")
    val plannedFor: String,
    val notes: String? = null,
    @SerialName("module_key")
    val moduleKey: String? = null,
    val rrule: String? = null,
    @SerialName("recurrence_hint")
    val recurrenceHint: String? = null,
    @SerialName("linked_source")
    val linkedSource: String? = null,
    @SerialName("linked_ref")
    val linkedRef: String? = null,
)
