package com.daynest.android.data.medication

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

interface MedicationApi {
    @GET("api/v1/medications")
    suspend fun listPlans(): List<MedicationPlanDto>

    @POST("api/v1/medications")
    suspend fun createPlan(
        @Body request: MedicationPlanInputDto,
    ): MedicationPlanDto

    @GET("api/v1/medication-doses/history")
    suspend fun getHistory(): MedicationHistoryResponseDto
}

@Serializable
data class MedicationPlanDto(
    val id: Int,
    val name: String,
    val instructions: String,
    @SerialName("start_date")
    val startDate: String,
    @SerialName("schedule_time")
    val scheduleTime: String,
    @SerialName("every_n_days")
    val everyNDays: Int,
    @SerialName("is_active")
    val isActive: Boolean,
)

@Serializable
data class MedicationPlanInputDto(
    val name: String,
    val instructions: String,
    @SerialName("start_date")
    val startDate: String,
    @SerialName("schedule_time")
    val scheduleTime: String,
    @SerialName("every_n_days")
    val everyNDays: Int,
)

@Serializable
data class MedicationHistoryResponseDto(
    val history: List<MedicationHistoryItemDto>,
)

@Serializable
data class MedicationHistoryItemDto(
    @SerialName("medication_dose_instance_id")
    val medicationDoseInstanceId: Int,
    val name: String,
    val instructions: String = "",
    @SerialName("scheduled_at")
    val scheduledAt: String = "",
    val status: String = "",
)
