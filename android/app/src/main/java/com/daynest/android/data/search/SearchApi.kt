package com.daynest.android.data.search

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import retrofit2.http.GET
import retrofit2.http.Query

interface SearchApi {
    @GET("api/search")
    suspend fun search(@Query("q") query: String, @Query("limit") limit: Int = 20): SearchResponseDto
}

@Serializable
data class RoutineSearchResultDto(
    val id: Int,
    val name: String,
    val description: String? = null,
    @SerialName("is_active")
    val isActive: Boolean
)

@Serializable
data class ChoreSearchResultDto(
    val id: Int,
    val name: String,
    val description: String? = null,
    val priority: String,
    val tags: List<String> = emptyList(),
    @SerialName("is_active")
    val isActive: Boolean
)

@Serializable
data class MedicationSearchResultDto(
    val id: Int,
    val name: String,
    val instructions: String,
    @SerialName("is_active")
    val isActive: Boolean
)

@Serializable
data class PlannedItemSearchResultDto(
    val id: Int,
    val title: String,
    val notes: String? = null,
    @SerialName("planned_for")
    val plannedFor: String,
    val priority: String,
    val tags: List<String> = emptyList(),
    @SerialName("is_done")
    val isDone: Boolean
)

@Serializable
data class SearchResponseDto(
    val query: String,
    @SerialName("routine_templates")
    val routineTemplates: List<RoutineSearchResultDto> = emptyList(),
    @SerialName("chore_templates")
    val choreTemplates: List<ChoreSearchResultDto> = emptyList(),
    @SerialName("medication_plans")
    val medicationPlans: List<MedicationSearchResultDto> = emptyList(),
    @SerialName("planned_items")
    val plannedItems: List<PlannedItemSearchResultDto> = emptyList()
)
