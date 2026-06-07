package com.daynest.android.feature.settings

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.daynest.android.BuildConfig
import com.daynest.android.core.auth.OidcAuthService
import com.daynest.android.core.storage.preferences.UserPreferencesRepository
import com.daynest.android.data.calendar.DeviceCalendar
import com.daynest.android.data.calendar.DeviceCalendarRepository
import com.daynest.android.data.push.PushRegistrationManager
import com.daynest.android.data.settings.IntegrationClientCreateResponseDto
import com.daynest.android.data.settings.IntegrationClientDto
import com.daynest.android.data.settings.IntegrationClientInputDto
import com.daynest.android.data.settings.OAuthSessionDto
import com.daynest.android.data.settings.SettingsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SettingsViewModel
    @Inject
    constructor(
        private val settingsRepository: SettingsRepository,
        private val oidcAuthService: OidcAuthService,
        private val userPreferencesRepository: UserPreferencesRepository,
        private val pushRegistrationManager: PushRegistrationManager,
        private val deviceCalendarRepository: DeviceCalendarRepository,
        @ApplicationContext private val appContext: Context,
    ) : ViewModel() {
        private val _uiState = MutableStateFlow<SettingsUiState>(SettingsUiState.Loading)
        val uiState: StateFlow<SettingsUiState> = _uiState.asStateFlow()

        private val deviceCalendarHandler =
            SettingsDeviceCalendarHandler(
                scope = viewModelScope,
                appContext = appContext,
                deviceCalendarRepository = deviceCalendarRepository,
                userPreferencesRepository = userPreferencesRepository,
                uiState = _uiState,
            )

        init {
            load()
        }

        fun onEvent(event: SettingsUiEvent) {
            when (event) {
                SettingsUiEvent.RetryClicked -> load()
                SettingsUiEvent.SignOutClicked -> {
                    viewModelScope.launch { runCatching { pushRegistrationManager.unregisterAllKnownEndpoints() } }
                    oidcAuthService.signOut()
                    _uiState.value = SettingsUiState.SignedOut
                }
                SettingsUiEvent.ShowCreateClientForm -> updateContent { it.copy(showCreateForm = true) }
                SettingsUiEvent.DismissCreateClientForm -> updateContent { it.copy(showCreateForm = false) }
                SettingsUiEvent.DismissNewKeyDialog -> updateContent { it.copy(newApiKey = null) }
                is SettingsUiEvent.CreateClient -> createClient(event.input)
                is SettingsUiEvent.UpdateServerUrl -> updateServerUrl(event.url)
                is SettingsUiEvent.RevokeSessionClicked -> revokeSession(event.sessionId)
                else -> onPreferencesEvent(event)
            }
        }

        private fun onPreferencesEvent(event: SettingsUiEvent) {
            when (event) {
                is SettingsUiEvent.UpdatePushNotificationsEnabled -> updatePushNotificationsEnabled(event.enabled)
                is SettingsUiEvent.UpdateBiometricLockEnabled -> updateBiometricLockEnabled(event.enabled)
                is SettingsUiEvent.UpdateBiometricIdleTimeoutMinutes -> updateBiometricIdleTimeoutMinutes(event.minutes)
                else -> deviceCalendarHandler.onPreferencesEvent(event)
            }
        }

        private fun load() {
            viewModelScope.launch {
                _uiState.value = SettingsUiState.Loading
                val prefsDeferred = async { userPreferencesRepository.preferences.first() }
                val clientsDeferred = async { settingsRepository.listClients() }
                val sessionsDeferred = async { settingsRepository.listSessions() }
                val deviceCalendarsDeferred = async { deviceCalendarRepository.listCalendars() }
                val prefs = prefsDeferred.await()
                val clientsResult = clientsDeferred.await()
                val sessionsResult = sessionsDeferred.await()
                val deviceCalendarsResult = deviceCalendarsDeferred.await()
                _uiState.value =
                    SettingsUiState.Content(
                        clients = clientsResult.getOrElse { emptyList() },
                        sessions = sessionsResult.getOrElse { emptyList() },
                        showCreateForm = false,
                        newApiKey = null,
                        clientsLoadError = clientsResult.isFailure,
                        sessionsLoadError = sessionsResult.isFailure,
                        customServerUrl = prefs.customServerUrl,
                        defaultServerUrl = BuildConfig.API_BASE_URL,
                        pushNotificationsEnabled = prefs.pushNotificationsEnabled,
                        biometricLockEnabled = prefs.biometricLockEnabled,
                        biometricIdleTimeoutMinutes = prefs.biometricIdleTimeoutMinutes,
                        calendarSyncEnabled = prefs.calendarSyncEnabled,
                        showDeviceCalendars = prefs.showDeviceCalendars,
                        deviceCalendars = deviceCalendarsResult.getOrElse { emptyList() },
                        enabledDeviceCalendarIds = prefs.enabledDeviceCalendarIds,
                    )
            }
        }

        private fun createClient(input: IntegrationClientInputDto) {
            viewModelScope.launch {
                settingsRepository.createClient(input).onSuccess { created ->
                    _uiState.update { current ->
                        if (current is SettingsUiState.Content) {
                            current.copy(
                                clients = current.clients + created.toDto(),
                                showCreateForm = false,
                                newApiKey = created.apiKey,
                            )
                        } else {
                            current
                        }
                    }
                }
            }
        }

        private fun updateServerUrl(url: String?) {
            viewModelScope.launch {
                runCatching { userPreferencesRepository.updateCustomServerUrl(url) }.onSuccess {
                    _uiState.update { current ->
                        if (current is SettingsUiState.Content) current.copy(customServerUrl = url) else current
                    }
                }
            }
        }

        private fun updatePushNotificationsEnabled(enabled: Boolean) {
            viewModelScope.launch {
                runCatching { userPreferencesRepository.updatePushNotificationsEnabled(enabled) }.onSuccess {
                    if (enabled) {
                        runCatching { pushRegistrationManager.registerIfEnabled() }
                    } else {
                        runCatching { pushRegistrationManager.unregisterAllKnownEndpoints() }
                    }
                    _uiState.update { current ->
                        if (current is SettingsUiState.Content) {
                            current.copy(pushNotificationsEnabled = enabled)
                        } else {
                            current
                        }
                    }
                }
            }
        }

        private fun updateBiometricLockEnabled(enabled: Boolean) {
            viewModelScope.launch {
                runCatching { userPreferencesRepository.updateBiometricLockEnabled(enabled) }.onSuccess {
                    _uiState.update { current ->
                        if (current is SettingsUiState.Content) {
                            current.copy(biometricLockEnabled = enabled)
                        } else {
                            current
                        }
                    }
                }
            }
        }

        private fun updateBiometricIdleTimeoutMinutes(minutes: Int) {
            viewModelScope.launch {
                val clamped = minutes.coerceIn(1, 240)
                runCatching { userPreferencesRepository.updateBiometricIdleTimeoutMinutes(clamped) }.onSuccess {
                    _uiState.update { current ->
                        if (current is SettingsUiState.Content) {
                            current.copy(biometricIdleTimeoutMinutes = clamped)
                        } else {
                            current
                        }
                    }
                }
            }
        }

        private fun revokeSession(id: String) {
            viewModelScope.launch {
                val result = settingsRepository.revokeSession(id)
                if (result.isSuccess) {
                    _uiState.update { current ->
                        if (current is SettingsUiState.Content) {
                            current.copy(sessions = current.sessions.filter { it.id != id })
                        } else {
                            current
                        }
                    }
                }
            }
        }

        private fun updateContent(transform: (SettingsUiState.Content) -> SettingsUiState.Content) {
            _uiState.update { current ->
                if (current is SettingsUiState.Content) transform(current) else current
            }
        }

        private fun IntegrationClientCreateResponseDto.toDto() =
            IntegrationClientDto(
                id = id,
                name = name,
                rateLimitPerMinute = rateLimitPerMinute,
                isActive = isActive,
            )
    }

sealed interface SettingsUiState {
    data object Loading : SettingsUiState

    data class Content(
        val clients: List<IntegrationClientDto>,
        val sessions: List<OAuthSessionDto> = emptyList(),
        val showCreateForm: Boolean,
        val newApiKey: String?,
        val clientsLoadError: Boolean,
        val sessionsLoadError: Boolean,
        val customServerUrl: String?,
        val defaultServerUrl: String,
        val pushNotificationsEnabled: Boolean,
        val biometricLockEnabled: Boolean,
        val biometricIdleTimeoutMinutes: Int,
        val calendarSyncEnabled: Boolean,
        val showDeviceCalendars: Boolean,
        val deviceCalendars: List<DeviceCalendar>,
        val enabledDeviceCalendarIds: Set<String>,
    ) : SettingsUiState

    data object SignedOut : SettingsUiState
}

sealed interface SettingsUiEvent {
    data object RetryClicked : SettingsUiEvent

    data object SignOutClicked : SettingsUiEvent

    data object ShowCreateClientForm : SettingsUiEvent

    data object DismissCreateClientForm : SettingsUiEvent

    data object DismissNewKeyDialog : SettingsUiEvent

    data class CreateClient(
        val input: IntegrationClientInputDto,
    ) : SettingsUiEvent

    data class UpdateServerUrl(
        val url: String?,
    ) : SettingsUiEvent

    data class RevokeSessionClicked(
        val sessionId: String,
    ) : SettingsUiEvent

    data class UpdatePushNotificationsEnabled(
        val enabled: Boolean,
    ) : SettingsUiEvent

    data class UpdateBiometricLockEnabled(
        val enabled: Boolean,
    ) : SettingsUiEvent

    data class UpdateBiometricIdleTimeoutMinutes(
        val minutes: Int,
    ) : SettingsUiEvent

    data class UpdateCalendarSyncEnabled(
        val enabled: Boolean,
    ) : SettingsUiEvent

    data class UpdateShowDeviceCalendars(
        val enabled: Boolean,
    ) : SettingsUiEvent

    data class UpdateDeviceCalendarEnabled(
        val calendarId: String,
        val enabled: Boolean,
    ) : SettingsUiEvent
}
