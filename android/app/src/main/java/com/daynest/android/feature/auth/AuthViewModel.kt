package com.daynest.android.feature.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.daynest.android.data.auth.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val authRepository: AuthRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(AuthUiState())
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    fun onEvent(event: AuthUiEvent) {
        when (event) {
            is AuthUiEvent.EmailChanged -> _uiState.update { it.copy(email = event.value, error = null) }
            is AuthUiEvent.PasswordChanged -> _uiState.update { it.copy(password = event.value, error = null) }
            AuthUiEvent.SignInClicked -> signIn()
        }
    }

    private fun signIn() {
        val current = _uiState.value
        if (current.email.isBlank() || current.password.isBlank()) {
            _uiState.update { it.copy(error = AuthError.MissingCredentials) }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isSubmitting = true, error = null) }

            val succeeded = try {
                authRepository.signIn(current.email.trim(), current.password)
            } catch (_: Exception) {
                false
            }

            _uiState.update {
                it.copy(
                    isSubmitting = false,
                    isSignedIn = succeeded,
                    error = if (succeeded) null else AuthError.SignInFailed,
                )
            }
        }
    }
}

data class AuthUiState(
    val email: String = "",
    val password: String = "",
    val isSubmitting: Boolean = false,
    val isSignedIn: Boolean = false,
    val error: AuthError? = null,
)

sealed interface AuthUiEvent {
    data class EmailChanged(val value: String) : AuthUiEvent
    data class PasswordChanged(val value: String) : AuthUiEvent
    data object SignInClicked : AuthUiEvent
}

enum class AuthError {
    MissingCredentials,
    SignInFailed,
}
