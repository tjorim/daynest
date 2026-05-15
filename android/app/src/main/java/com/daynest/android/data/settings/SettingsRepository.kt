package com.daynest.android.data.settings

import kotlinx.coroutines.CancellationException
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SettingsRepository
    @Inject
    constructor(
        private val settingsApi: SettingsApi,
    ) {
        @Suppress("TooGenericExceptionCaught")
        suspend fun listClients(): Result<List<IntegrationClientDto>> =
            try {
                Result.success(settingsApi.listClients())
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                Result.failure(e)
            }

        @Suppress("TooGenericExceptionCaught")
        suspend fun createClient(request: IntegrationClientInputDto): Result<IntegrationClientCreateResponseDto> =
            try {
                Result.success(settingsApi.createClient(request))
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                Result.failure(e)
            }
    }
