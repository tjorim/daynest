package com.daynest.android.feature.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.daynest.android.data.auth.AuthRepository
import com.daynest.android.data.settings.IntegrationClientCreateResponseDto
import com.daynest.android.data.settings.IntegrationClientDto
import com.daynest.android.data.settings.IntegrationClientInputDto
import com.daynest.android.data.settings.SettingsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SettingsViewModel
    @Inject
    constructor(
        private val settingsRepository: SettingsRepository,
        private val authRepository: AuthRepository,
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
                SettingsUiEvent.DismissCreateClientForm -> dismissCreateForm()
                SettingsUiEvent.DismissNewKeyDialog -> dismissNewKeyDialog()
                is SettingsUiEvent.CreateClient -> createClient(event.input)
            }
        }

        private fun load() {
            viewModelScope.launch {
                _uiState.value = SettingsUiState.Loading
                val result = settingsRepository.listClients()
                _uiState.value =
                    SettingsUiState.Content(
                        clients = result.getOrElse { emptyList() },
                        showCreateForm = false,
                        newApiKey = null,
                        loadError = result.isFailure,
                    )
            }
        }

        private fun showCreateForm() {
            _uiState.update { current ->
                if (current is SettingsUiState.Content) current.copy(showCreateForm = true) else current
            }
        }

        private fun dismissCreateForm() {
            _uiState.update { current ->
                if (current is SettingsUiState.Content) current.copy(showCreateForm = false) else current
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

        @Suppress("TooGenericExceptionCaught", "SwallowedException")
        private fun signOut() {
            viewModelScope.launch {
                try {
                    authRepository.signOut()
                    _uiState.value = SettingsUiState.SignedOut
                } catch (e: CancellationException) {
                    throw e
                } catch (e: Exception) {
                    // sign-out failed; leave state unchanged so the UI remains responsive
                }
            }
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
        val showCreateForm: Boolean,
        val newApiKey: String?,
        val loadError: Boolean,
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
}
