package com.daynest.android.feature.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.daynest.android.core.model.TodaySummary
import com.daynest.android.data.today.TodayRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class HomeViewModel
    @Inject
    constructor(
        private val repository: TodayRepository,
    ) : ViewModel() {
        private val _uiState = MutableStateFlow<HomeUiState>(HomeUiState.Loading)

        val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

        init {
            viewModelScope.launch {
                repository.observeTodaySummary().collect { summary ->
                    _uiState.update { current ->
                        if (summary == null) {
                            current
                        } else {
                            HomeUiState.Content(summary = summary, isStale = false)
                        }
                    }
                }
            }
            refresh()
        }

        fun onEvent(event: HomeUiEvent) {
            when (event) {
                HomeUiEvent.RetryClicked -> refresh()
                HomeUiEvent.OpenTodayDetailsClicked -> Unit
            }
        }

        private fun refresh() {
            viewModelScope.launch {
                if (_uiState.value !is HomeUiState.Content) {
                    _uiState.value = HomeUiState.Loading
                }
                val result = repository.refresh()
                if (result.isFailure) {
                    _uiState.update { current ->
                        when (current) {
                            is HomeUiState.Content -> current.copy(isStale = true)
                            else -> HomeUiState.Error(HomeError.LoadTodayFailed)
                        }
                    }
                }
            }
        }
    }

sealed interface HomeUiState {
    data object Loading : HomeUiState

    data class Content(
        val summary: TodaySummary,
        val isStale: Boolean = false,
    ) : HomeUiState

    data class Error(
        val error: HomeError,
    ) : HomeUiState
}

sealed interface HomeUiEvent {
    data object RetryClicked : HomeUiEvent

    data object OpenTodayDetailsClicked : HomeUiEvent
}

enum class HomeError {
    LoadTodayFailed,
}
