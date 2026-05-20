package com.daynest.android.feature.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.daynest.android.BuildConfig
import com.daynest.android.core.auth.OidcAuthService
import com.daynest.android.core.storage.preferences.UserPreferencesRepository
import com.daynest.android.data.settings.IntegrationClientCreateResponseDto
import com.daynest.android.data.settings.IntegrationClientDto
import com.daynest.android.data.settings.IntegrationClientInputDto
import com.daynest.android.data.settings.OAuthSessionDto
import com.daynest.android.data.settings.SettingsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
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
    ) : ViewModel() {
        private val _uiState = MutableStateFlow<SettingsUiState>(SettingsUiState.Loading)
        val uiState: StateFlow<SettingsUiState> = _uiState.asStateFlow()

        init {
            load()
        }

        fun onEvent(event: SettingsUiEvent) {
            when (event) {
                SettingsUiEvent.RetryClicked -> load()
                SettingsUiEvent.SignOutClicked -> signOut()
                SettingsUiEvent.ShowCreateClientForm -> showCreateForm()
                is SettingsUiEvent.ShowCreateClientFormWithPreset -> showCreateFormWithPreset(event.preset)
                SettingsUiEvent.DismissCreateClientForm -> dismissCreateForm()
                SettingsUiEvent.DismissNewKeyDialog -> dismissNewKeyDialog()
                is SettingsUiEvent.CreateClient -> createClient(event.input)
                is SettingsUiEvent.UpdateServerUrl -> updateServerUrl(event.url)
                is SettingsUiEvent.RevokeSessionClicked -> revokeSession(event.sessionId)
            }
        }

        private fun load() {
            viewModelScope.launch {
                _uiState.value = SettingsUiState.Loading
                val prefsDeferred = async { userPreferencesRepository.preferences.first() }
                val clientsDeferred = async { settingsRepository.listClients() }
                val sessionsDeferred = async { settingsRepository.listSessions() }
                val prefs = prefsDeferred.await()
                val clientsResult = clientsDeferred.await()
                val sessionsResult = sessionsDeferred.await()
                _uiState.value =
                    SettingsUiState.Content(
                        clients = clientsResult.getOrElse { emptyList() },
                        sessions = sessionsResult.getOrElse { emptyList() },
                        showCreateForm = false,
                        createFormPreset = null,
                        newApiKey = null,
                        loadError = clientsResult.isFailure || sessionsResult.isFailure,
                        customServerUrl = prefs.customServerUrl,
                        defaultServerUrl = BuildConfig.API_BASE_URL,
                    )
            }
        }

        private fun showCreateForm() {
            _uiState.update { current ->
                if (current is SettingsUiState.Content) {
                    current.copy(showCreateForm = true, createFormPreset = null)
                } else {
                    current
                }
            }
        }

        private fun showCreateFormWithPreset(preset: IntegrationClientInputDto) {
            _uiState.update { current ->
                if (current is SettingsUiState.Content) {
                    current.copy(showCreateForm = true, createFormPreset = preset)
                } else {
                    current
                }
            }
        }

        private fun dismissCreateForm() {
            _uiState.update { current ->
                if (current is SettingsUiState.Content) {
                    current.copy(showCreateForm = false, createFormPreset = null)
                } else {
                    current
                }
            }
        }

        private fun dismissNewKeyDialog() {
            _uiState.update { current ->
                if (current is SettingsUiState.Content) current.copy(newApiKey = null) else current
            }
        }

        private fun createClient(input: IntegrationClientInputDto) {
            viewModelScope.launch {
                val result = settingsRepository.createClient(input)
                result.onSuccess { created ->
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
                val result = runCatching { userPreferencesRepository.updateCustomServerUrl(url) }
                if (result.isSuccess) {
                    _uiState.update { current ->
                        if (current is SettingsUiState.Content) current.copy(customServerUrl = url) else current
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

        private fun signOut() {
            oidcAuthService.signOut()
            _uiState.value = SettingsUiState.SignedOut
        }

        private fun IntegrationClientCreateResponseDto.toDto() =
            IntegrationClientDto(
                id = id,
                name = name,
                scopes = scopes,
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
        val createFormPreset: IntegrationClientInputDto?,
        val newApiKey: String?,
        val loadError: Boolean,
        val customServerUrl: String?,
        val defaultServerUrl: String,
    ) : SettingsUiState

    data object SignedOut : SettingsUiState
}

sealed interface SettingsUiEvent {
    data object RetryClicked : SettingsUiEvent

    data object SignOutClicked : SettingsUiEvent

    data object ShowCreateClientForm : SettingsUiEvent

    data class ShowCreateClientFormWithPreset(
        val preset: IntegrationClientInputDto,
    ) : SettingsUiEvent

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
}
