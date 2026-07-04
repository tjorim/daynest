package com.daynest.android.app.session

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.daynest.android.core.storage.preferences.UserPreferencesRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

@HiltViewModel
class BiometricGateViewModel
@Inject
constructor(private val userPreferencesRepository: UserPreferencesRepository) :
    ViewModel() {
    private val _uiState = MutableStateFlow(BiometricGateUiState())
    val uiState: StateFlow<BiometricGateUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            userPreferencesRepository.preferences.collect { prefs ->
                _uiState.update { current ->
                    current.copy(
                        enabled = prefs.biometricLockEnabled,
                        timeoutMinutes = prefs.biometricIdleTimeoutMinutes,
                        lastBackgroundEpochMillis = prefs.lastBackgroundEpochMillis
                    )
                }
            }
        }
    }

    fun onAppResumed(nowEpochMillis: Long = System.currentTimeMillis()) {
        _uiState.update { current ->
            if (!current.enabled) {
                current.copy(requireAuthentication = false)
            } else {
                val idleMillis = nowEpochMillis - current.lastBackgroundEpochMillis
                val threshold = current.timeoutMinutes * 60_000L
                current.copy(
                    requireAuthentication =
                    current.lastBackgroundEpochMillis > 0 &&
                        idleMillis >= threshold
                )
            }
        }
    }

    fun onAuthenticated() {
        _uiState.update { it.copy(requireAuthentication = false) }
    }
}

data class BiometricGateUiState(
    val enabled: Boolean = false,
    val timeoutMinutes: Int = 5,
    val lastBackgroundEpochMillis: Long = 0L,
    val requireAuthentication: Boolean = false
)
