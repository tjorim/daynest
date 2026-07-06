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
    val planned: List<PlannedTodayItemDto> = emptyList()
)

@Serializable
data class MedicationTodayItemDto(
    @SerialName("medication_dose_instance_id")
    val medicationDoseInstanceId: Int,
    val name: String,
    val instructions: String = "",
    @SerialName("scheduled_at")
    val scheduledAt: String = "",
    val status: String = "scheduled"
)

@Serializable
data class MedicationHistoryItemDto(
    @SerialName("medication_dose_instance_id")
    val medicationDoseInstanceId: Int,
    val name: String,
    val instructions: String = "",
    @SerialName("scheduled_at")
    val scheduledAt: String = "",
    val status: String = "taken"
)

@Serializable
data class RoutineTodayItemDto(
    @SerialName("task_instance_id")
    val taskInstanceId: Int,
    val title: String,
    val status: String = "pending",
    @SerialName("scheduled_date")
    val scheduledDate: String = ""
)

@Serializable
data class OverdueTodayItemDto(
    @SerialName("chore_instance_id")
    val choreInstanceId: Int,
    val title: String,
    val status: String = "pending",
    @SerialName("overdue_since")
    val overdueSince: String = ""
)

@Serializable
data class DueTodayItemDto(
    @SerialName("chore_instance_id")
    val choreInstanceId: Int,
    val title: String,
    val status: String = "pending",
    @SerialName("scheduled_date")
    val scheduledDate: String = ""
)

@Serializable
data class UpcomingTodayItemDto(
    @SerialName("chore_instance_id")
    val choreInstanceId: Int,
    val title: String,
    @SerialName("scheduled_date")
    val scheduledDate: String = ""
)

@Serializable
data class PlannedTodayItemDto(
    val id: Int,
    val title: String,
    @SerialName("is_done")
    val isDone: Boolean,
    @SerialName("planned_for")
    val plannedFor: String = "",
    @SerialName("time_of_day")
    val timeOfDay: String? = null,
    @SerialName("duration_minutes")
    val durationMinutes: Int? = null,
    val notes: String? = null,
    @SerialName("module_key")
    val moduleKey: String? = null,
    val rrule: String? = null,
    @SerialName("recurrence_series_id")
    val recurrenceSeriesId: String? = null,
    @SerialName("recurrence_hint")
    val recurrenceHint: String? = null,
    @SerialName("linked_source")
    val linkedSource: String? = null,
    @SerialName("linked_ref")
    val linkedRef: String? = null,
    @SerialName("auto_add_to_list_id")
    val autoAddToListId: Int? = null,
    val priority: String = "normal",
    val tags: List<String> = emptyList()
)
