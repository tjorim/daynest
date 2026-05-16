package com.daynest.android.feature.auth

import android.content.Intent
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.daynest.android.core.auth.OidcAuthService
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val oidcAuthService: OidcAuthService,
) : ViewModel() {
    private val _uiState = MutableStateFlow(AuthUiState())
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    private val _signInIntent = MutableSharedFlow<Intent>(extraBufferCapacity = 1)
    val signInIntent: SharedFlow<Intent> = _signInIntent.asSharedFlow()

    fun onSignInClicked() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            runCatching { oidcAuthService.buildSignInIntent() }
                .onSuccess { intent ->
                    _uiState.update { it.copy(isLoading = false) }
                    _signInIntent.emit(intent)
                }
                .onFailure { ex ->
                    if (ex is CancellationException) throw ex
                    _uiState.update { it.copy(isLoading = false, error = AuthError.SignInFailed) }
                }
        }
    }

    fun handleAuthorizationResult(resultCode: Int, data: Intent?) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            val succeeded = oidcAuthService.handleAuthorizationResult(resultCode, data)
            _uiState.update {
                it.copy(
                    isLoading = false,
                    isSignedIn = succeeded,
                    error = if (succeeded) null else AuthError.SignInFailed,
                )
            }
        }
    }
}

data class AuthUiState(
    val isLoading: Boolean = false,
    val isSignedIn: Boolean = false,
    val error: AuthError? = null,
)

enum class AuthError {
    SignInFailed,
}
