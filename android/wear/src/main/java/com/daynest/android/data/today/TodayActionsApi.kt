package com.daynest.android.data.today

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import retrofit2.http.POST
import retrofit2.http.Path

interface TodayActionsApi {
    @POST("api/chores/{id}/complete")
    suspend fun completeChore(@Path("id") id: Int): ChoreMutationDto

    @POST("api/medication-doses/{id}/take")
    suspend fun takeDose(@Path("id") id: Int): DoseMutationDto
}

@Serializable
data class ChoreMutationDto(
    @SerialName("chore_instance_id")
    val choreInstanceId: Int,
    val status: String
)

@Serializable
data class DoseMutationDto(
    @SerialName("medication_dose_instance_id")
    val medicationDoseInstanceId: Int,
    val status: String
)
