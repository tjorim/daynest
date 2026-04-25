package com.daynest.android.app.session

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.daynest.android.data.auth.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

@HiltViewModel
class SessionGateViewModel @Inject constructor(
    private val authRepository: AuthRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow<SessionGateUiState>(SessionGateUiState.Loading)
    val uiState: StateFlow<SessionGateUiState> = _uiState.asStateFlow()

    init {
        decideRoute()
    }

    private fun decideRoute() {
        viewModelScope.launch {
            _uiState.value = if (authRepository.hasValidSession()) {
                SessionGateUiState.GoHome
            } else {
                SessionGateUiState.GoAuth
            }
        }
    }
}

sealed interface SessionGateUiState {
    data object Loading : SessionGateUiState
    data object GoHome : SessionGateUiState
    data object GoAuth : SessionGateUiState
}
