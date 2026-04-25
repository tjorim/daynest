package com.daynest.android.data.today

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import retrofit2.http.GET

interface TodayApi {
    @GET("api/v1/today")
    suspend fun getToday(): TodayResponseDto
}

@Serializable
data class TodayResponseDto(
    @SerialName("medication")
    val medication: List<MedicationTodayItemDto> = emptyList(),
    @SerialName("medication_history")
    val medicationHistory: List<MedicationHistoryItemDto> = emptyList(),
    val routines: List<RoutineTodayItemDto> = emptyList(),
    val overdue: List<OverdueTodayItemDto> = emptyList(),
    @SerialName("due_today")
    val dueToday: List<DueTodayItemDto> = emptyList(),
    val upcoming: List<UpcomingTodayItemDto> = emptyList(),
    val planned: List<PlannedTodayItemDto> = emptyList(),
)

@Serializable
data class MedicationTodayItemDto(
    @SerialName("medication_dose_instance_id")
    val medicationDoseInstanceId: Int,
    val name: String,
)

@Serializable
data class MedicationHistoryItemDto(
    @SerialName("medication_dose_instance_id")
    val medicationDoseInstanceId: Int,
    val name: String,
)

@Serializable
data class RoutineTodayItemDto(
    @SerialName("task_instance_id")
    val taskInstanceId: Int,
    val title: String,
)

@Serializable
data class OverdueTodayItemDto(
    @SerialName("chore_instance_id")
    val choreInstanceId: Int,
    val title: String,
)

@Serializable
data class DueTodayItemDto(
    @SerialName("chore_instance_id")
    val choreInstanceId: Int,
    val title: String,
)

@Serializable
data class UpcomingTodayItemDto(
    @SerialName("chore_instance_id")
    val choreInstanceId: Int,
    val title: String,
)

@Serializable
data class PlannedTodayItemDto(
    val id: Int,
    val title: String,
    @SerialName("is_done")
    val isDone: Boolean,
)
