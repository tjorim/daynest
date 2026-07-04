package com.daynest.android.data.today

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import retrofit2.http.Body
import retrofit2.http.POST
import retrofit2.http.Path

interface TodayActionsApi {
    @POST("api/v1/chores/{id}/complete")
    suspend fun completeChore(@Path("id") id: Int): ChoreMutationDto

    @POST("api/v1/chores/{id}/skip")
    suspend fun skipChore(@Path("id") id: Int): ChoreMutationDto

    @POST("api/v1/chores/{id}/reschedule")
    suspend fun rescheduleChore(@Path("id") id: Int, @Body request: RescheduleChoreDto): ChoreMutationDto

    @POST("api/v1/tasks/{id}/complete")
    suspend fun completeTask(@Path("id") id: Int): TaskMutationDto

    @POST("api/v1/tasks/{id}/skip")
    suspend fun skipTask(@Path("id") id: Int): TaskMutationDto

    @POST("api/v1/tasks/{id}/start")
    suspend fun startTask(@Path("id") id: Int): TaskMutationDto

    @POST("api/v1/medication-doses/{id}/take")
    suspend fun takeDose(@Path("id") id: Int): DoseMutationDto

    @POST("api/v1/medication-doses/{id}/skip")
    suspend fun skipDose(@Path("id") id: Int): DoseMutationDto
}

@Serializable
data class ChoreMutationDto(
    @SerialName("chore_instance_id")
    val choreInstanceId: Int,
    val status: String
)

@Serializable
data class TaskMutationDto(
    @SerialName("task_instance_id")
    val taskInstanceId: Int,
    val status: String
)

@Serializable
data class DoseMutationDto(
    @SerialName("medication_dose_instance_id")
    val medicationDoseInstanceId: Int,
    val status: String
)

@Serializable
data class RescheduleChoreDto(
    @SerialName("scheduled_date")
    val scheduledDate: String
)
