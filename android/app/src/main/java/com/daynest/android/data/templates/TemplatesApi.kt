package com.daynest.android.data.templates

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path

interface TemplatesApi {
    @GET("api/v1/routines")
    suspend fun listRoutines(): List<RoutineTemplateDto>

    @POST("api/v1/routines")
    suspend fun createRoutine(
        @Body request: RoutineTemplateInputDto,
    ): RoutineTemplateDto

    @PUT("api/v1/routines/{id}")
    suspend fun updateRoutine(
        @Path("id") id: Int,
        @Body request: RoutineTemplateInputDto,
    ): RoutineTemplateDto

    @DELETE("api/v1/routines/{id}")
    suspend fun deleteRoutine(
        @Path("id") id: Int,
    )

    @GET("api/v1/chore-templates")
    suspend fun listChores(): List<ChoreTemplateDto>

    @POST("api/v1/chore-templates")
    suspend fun createChore(
        @Body request: ChoreTemplateInputDto,
    ): ChoreTemplateDto

    @PUT("api/v1/chore-templates/{id}")
    suspend fun updateChore(
        @Path("id") id: Int,
        @Body request: ChoreTemplateInputDto,
    ): ChoreTemplateDto

    @DELETE("api/v1/chore-templates/{id}")
    suspend fun deleteChore(
        @Path("id") id: Int,
    )
}

@Serializable
data class RoutineTemplateDto(
    val id: Int,
    val name: String,
    val description: String? = null,
    @SerialName("start_date")
    val startDate: String,
    @SerialName("every_n_days")
    val everyNDays: Int,
    @SerialName("due_time")
    val dueTime: String? = null,
    @SerialName("is_active")
    val isActive: Boolean,
    @SerialName("created_at")
    val createdAt: String,
)

@Serializable
data class RoutineTemplateInputDto(
    val name: String,
    val description: String? = null,
    @SerialName("start_date")
    val startDate: String,
    @SerialName("every_n_days")
    val everyNDays: Int,
    @SerialName("due_time")
    val dueTime: String? = null,
    @SerialName("is_active")
    val isActive: Boolean,
)

@Serializable
data class ChoreTemplateDto(
    val id: Int,
    val name: String,
    val description: String? = null,
    @SerialName("start_date")
    val startDate: String,
    @SerialName("every_n_days")
    val everyNDays: Int,
    @SerialName("is_active")
    val isActive: Boolean,
    @SerialName("created_at")
    val createdAt: String,
)

@Serializable
data class ChoreTemplateInputDto(
    val name: String,
    val description: String? = null,
    @SerialName("start_date")
    val startDate: String,
    @SerialName("every_n_days")
    val everyNDays: Int,
    @SerialName("is_active")
    val isActive: Boolean,
)
