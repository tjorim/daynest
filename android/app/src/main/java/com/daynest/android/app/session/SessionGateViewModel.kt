package com.daynest.android.app.session

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.daynest.android.core.auth.OidcAuthService
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SessionGateViewModel
    @Inject
    constructor(
        private val oidcAuthService: OidcAuthService,
    ) : ViewModel() {
        private val _uiState = MutableStateFlow<SessionGateUiState>(SessionGateUiState.Loading)
        val uiState: StateFlow<SessionGateUiState> = _uiState.asStateFlow()

        init {
            viewModelScope.launch {
                _uiState.value =
                    if (oidcAuthService.isAuthorized) {
                        val token = oidcAuthService.getFreshAccessToken()
                        if (token != null) SessionGateUiState.GoHome else SessionGateUiState.GoAuth
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
