package com.daynest.android.feature.auth

import android.content.Intent
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.daynest.android.BuildConfig
import com.daynest.android.core.auth.OidcAuthService
import com.daynest.android.core.storage.ApiBaseUrlOverrideStore
import com.daynest.android.data.push.PushRegistrationManager
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

@HiltViewModel
class AuthViewModel
@Inject
constructor(
    private val oidcAuthService: OidcAuthService,
    private val apiBaseUrlOverrideStore: ApiBaseUrlOverrideStore,
    private val pushRegistrationManager: PushRegistrationManager
) : ViewModel() {
    private val _uiState =
        MutableStateFlow(AuthUiState(defaultServerUrl = BuildConfig.API_BASE_URL))
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            val customServerUrl = apiBaseUrlOverrideStore.override.first()
            _uiState.update { it.copy(customServerUrl = customServerUrl) }
        }
    }

    private val _signInIntent = MutableSharedFlow<Intent>(extraBufferCapacity = 1)
    val signInIntent: SharedFlow<Intent> = _signInIntent.asSharedFlow()

    fun onSignInClicked() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            runCatching { oidcAuthService.buildSignInIntent() }
                .onSuccess { intent ->
                    _uiState.update { it.copy(isLoading = false) }
                    _signInIntent.emit(intent)
                }.onFailure { ex ->
                    if (ex is CancellationException) throw ex
                    _uiState.update { it.copy(isLoading = false, error = AuthError.SignInFailed) }
                }
        }
    }

    fun updateServerUrl(url: String?) {
        viewModelScope.launch {
            runCatching {
                if (url == null) {
                    apiBaseUrlOverrideStore.clearOverride()
                } else {
                    apiBaseUrlOverrideStore.setOverride(url)
                }
            }.onSuccess {
                _uiState.update { it.copy(customServerUrl = url) }
            }
        }
    }

    fun handleAuthorizationResult(resultCode: Int, data: Intent?) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            val succeeded = oidcAuthService.handleAuthorizationResult(resultCode, data)
            if (succeeded) {
                runCatching { pushRegistrationManager.registerIfEnabled() }
            }
            _uiState.update {
                it.copy(
                    isLoading = false,
                    isSignedIn = succeeded,
                    error = if (succeeded) null else AuthError.SignInFailed
                )
            }
        }
    }
}

data class AuthUiState(
    val isLoading: Boolean = false,
    val isSignedIn: Boolean = false,
    val error: AuthError? = null,
    val customServerUrl: String? = null,
    val defaultServerUrl: String = ""
)

enum class AuthError {
    SignInFailed
}
