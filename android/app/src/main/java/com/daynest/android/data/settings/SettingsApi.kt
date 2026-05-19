package com.daynest.android.data.settings

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

interface SettingsApi {
    @GET("api/v1/integrations/clients")
    suspend fun listClients(): List<IntegrationClientDto>

    @POST("api/v1/integrations/clients")
    suspend fun createClient(
        @Body request: IntegrationClientInputDto,
    ): IntegrationClientCreateResponseDto

    @GET("api/v1/auth/sessions")
    suspend fun listSessions(): List<OAuthSessionDto>

    @DELETE("api/v1/auth/sessions/{id}")
    suspend fun revokeSession(
        @Path("id") id: String,
    )
}

@Serializable
data class IntegrationClientDto(
    val id: Int,
    val name: String,
    val scopes: List<String>,
    @SerialName("rate_limit_per_minute")
    val rateLimitPerMinute: Int,
    @SerialName("is_active")
    val isActive: Boolean,
)

@Serializable
data class IntegrationClientInputDto(
    val name: String,
    val scopes: List<String>,
    @SerialName("rate_limit_per_minute")
    val rateLimitPerMinute: Int,
)

@Serializable
data class OAuthSessionDto(
    val id: String,
    @SerialName("ip_address")
    val ipAddress: String? = null,
    val started: Long? = null,
    @SerialName("last_access")
    val lastAccess: Long? = null,
    val expires: Long? = null,
    val clients: Map<String, String> = emptyMap(),
)

@Serializable
data class IntegrationClientCreateResponseDto(
    val id: Int,
    val name: String,
    val scopes: List<String>,
    @SerialName("rate_limit_per_minute")
    val rateLimitPerMinute: Int,
    @SerialName("is_active")
    val isActive: Boolean,
    @SerialName("api_key")
    val apiKey: String,
)
