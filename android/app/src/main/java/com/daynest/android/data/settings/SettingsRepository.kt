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
}
