package com.daynest.android.data.settings

import com.daynest.android.data.safeApiCall
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SettingsRepository
@Inject
constructor(private val settingsApi: SettingsApi) {
    suspend fun listClients(): Result<List<IntegrationClientDto>> = safeApiCall { settingsApi.listClients() }

    suspend fun createClient(request: IntegrationClientInputDto): Result<IntegrationClientCreateResponseDto> =
        safeApiCall { settingsApi.createClient(request) }

    suspend fun listSessions(): Result<List<OAuthSessionDto>> = safeApiCall { settingsApi.listSessions() }

    suspend fun revokeSession(id: String): Result<Unit> = safeApiCall { settingsApi.revokeSession(id) }

    suspend fun getUserSettings(): Result<UserSettingsDto> = safeApiCall { settingsApi.getUserSettings() }

    suspend fun updateUserSettings(request: UserSettingsPatchDto): Result<UserSettingsDto> =
        safeApiCall { settingsApi.updateUserSettings(request) }

    suspend fun getCalendarFeed(): Result<CalendarFeedDto> = safeApiCall { settingsApi.getCalendarFeed() }

    suspend fun regenerateCalendarFeed(): Result<CalendarFeedDto> =
        safeApiCall { settingsApi.regenerateCalendarFeed() }

    suspend fun deleteCurrentUser(): Result<Unit> = safeApiCall { settingsApi.deleteCurrentUser() }
}
