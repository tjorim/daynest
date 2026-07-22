package com.daynest.android.data.medication

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path

interface MedicationApi {
    @GET("api/medications")
    suspend fun listPlans(): List<MedicationPlanDto>

    @POST("api/medications")
    suspend fun createPlan(@Body request: MedicationPlanInputDto): MedicationPlanDto

    @PUT("api/medications/{id}")
    suspend fun updatePlan(@Path("id") id: Int, @Body request: MedicationPlanUpdateDto): MedicationPlanDto

    @DELETE("api/medications/{id}")
    suspend fun deletePlan(@Path("id") id: Int)

    @GET("api/medication-doses/history")
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
    val isActive: Boolean
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
    val everyNDays: Int
)

@Serializable
data class MedicationPlanUpdateDto(
    val name: String,
    val instructions: String,
    @SerialName("start_date")
    val startDate: String,
    @SerialName("schedule_time")
    val scheduleTime: String,
    @SerialName("every_n_days")
    val everyNDays: Int,
    @SerialName("is_active")
    val isActive: Boolean
)

@Serializable
data class MedicationHistoryResponseDto(val history: List<MedicationHistoryItemDto>)

@Serializable
data class MedicationHistoryItemDto(
    @SerialName("medication_dose_instance_id")
    val medicationDoseInstanceId: Int,
    val name: String,
    val instructions: String = "",
    @SerialName("scheduled_at")
    val scheduledAt: String = "",
    val status: String = ""
)
