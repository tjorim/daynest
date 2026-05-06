package com.daynest.android.data.auth

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

interface AuthApi {
    @POST("api/v1/auth/sign-in")
    suspend fun signIn(
        @Body request: SignInRequestDto,
    ): AuthSessionDto

    @GET("api/v1/auth/session")
    suspend fun restoreSession(): AuthSessionDto

    @POST("api/v1/auth/refresh")
    suspend fun refresh(
        @Body request: RefreshRequestDto,
    ): AuthSessionDto
}

@Serializable
data class SignInRequestDto(
    val email: String,
    val password: String,
)

@Serializable
data class RefreshRequestDto(
    @SerialName("refresh_token")
    val refreshToken: String,
)

@Serializable
data class AuthSessionDto(
    @SerialName("access_token")
    val accessToken: String,
    @SerialName("refresh_token")
    val refreshToken: String? = null,
)
