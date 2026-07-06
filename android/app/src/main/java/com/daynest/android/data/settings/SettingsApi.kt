package com.daynest.android.data.settings

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path

interface SettingsApi {
    @GET("api/v1/integrations/clients")
    suspend fun listClients(): List<IntegrationClientDto>

    @POST("api/v1/integrations/clients")
    suspend fun createClient(@Body request: IntegrationClientInputDto): IntegrationClientCreateResponseDto

    @GET("api/v1/auth/sessions")
    suspend fun listSessions(): List<OAuthSessionDto>

    @DELETE("api/v1/auth/sessions/{id}")
    suspend fun revokeSession(@Path("id") id: String)

    @GET("api/users/me/settings")
    suspend fun getUserSettings(): UserSettingsDto

    @PATCH("api/users/me/settings")
    suspend fun updateUserSettings(@Body request: UserSettingsPatchDto): UserSettingsDto

    @GET("api/calendar/feed")
    suspend fun getCalendarFeed(): CalendarFeedDto

    @POST("api/calendar/feed/regenerate")
    suspend fun regenerateCalendarFeed(): CalendarFeedDto
}

@Serializable
data class IntegrationClientDto(
    val id: Int,
    val name: String,
    @SerialName("rate_limit_per_minute")
    val rateLimitPerMinute: Int,
    @SerialName("is_active")
    val isActive: Boolean
)

@Serializable
data class IntegrationClientInputDto(
    val name: String,
    @SerialName("rate_limit_per_minute")
    val rateLimitPerMinute: Int
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
    val clients: List<OAuthSessionClientDto> = emptyList()
)

@Serializable
data class OAuthSessionClientDto(
    val clientId: String,
    val clientName: String? = null,
    val userConsentRequired: Boolean = false,
    val inUse: Boolean = false,
    val offlineAccess: Boolean = false
)

@Serializable
data class IntegrationClientCreateResponseDto(
    val id: Int,
    val name: String,
    @SerialName("rate_limit_per_minute")
    val rateLimitPerMinute: Int,
    @SerialName("is_active")
    val isActive: Boolean,
    @SerialName("api_key")
    val apiKey: String,
    @SerialName("client_id")
    val clientId: String? = null,
    @SerialName("client_secret")
    val clientSecret: String? = null,
    @SerialName("token_url")
    val tokenUrl: String? = null
)

@Serializable
data class UserSettingsDto(
    val timezone: String,
    @SerialName("default_snooze_days")
    val defaultSnoozeDays: Int,
    @SerialName("medication_reminder_minutes")
    val medicationReminderMinutes: Int,
    @SerialName("quiet_hours_start")
    val quietHoursStart: String? = null,
    @SerialName("quiet_hours_end")
    val quietHoursEnd: String? = null,
    @SerialName("push_overdue_chores_enabled")
    val pushOverdueChoresEnabled: Boolean,
    @SerialName("push_medication_reminders_enabled")
    val pushMedicationRemindersEnabled: Boolean,
    @SerialName("push_missed_medications_enabled")
    val pushMissedMedicationsEnabled: Boolean
)

@Serializable
data class UserSettingsPatchDto(
    val timezone: String? = null,
    @SerialName("medication_reminder_minutes")
    val medicationReminderMinutes: Int? = null,
    @SerialName("quiet_hours_start")
    val quietHoursStart: String? = null,
    @SerialName("quiet_hours_end")
    val quietHoursEnd: String? = null,
    @SerialName("push_overdue_chores_enabled")
    val pushOverdueChoresEnabled: Boolean? = null,
    @SerialName("push_medication_reminders_enabled")
    val pushMedicationRemindersEnabled: Boolean? = null,
    @SerialName("push_missed_medications_enabled")
    val pushMissedMedicationsEnabled: Boolean? = null
)

@Serializable
data class CalendarFeedDto(
    val token: String,
    @SerialName("feed_url")
    val feedUrl: String
)
