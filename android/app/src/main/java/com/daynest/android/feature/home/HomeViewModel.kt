package com.daynest.android.feature.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.daynest.android.core.model.TodaySummary
import com.daynest.android.data.today.TodayRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val repository: TodayRepository,
) : ViewModel() {
    private val _uiState = MutableStateFlow<HomeUiState>(HomeUiState.Loading)

    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    init {
        refreshToday()
    }

    fun onEvent(event: HomeUiEvent) {
        when (event) {
            HomeUiEvent.RetryClicked -> refreshToday()
            HomeUiEvent.OpenTodayDetailsClicked -> Unit
        }
    }

    private fun refreshToday() {
        viewModelScope.launch {
            _uiState.value = HomeUiState.Loading

            _uiState.value = runCatching { repository.getTodaySummary() }
                .fold(
                    onSuccess = { HomeUiState.Content(it) },
                    onFailure = { HomeUiState.Error(HomeError.LoadTodayFailed) },
                )
        }
    }
}

sealed interface HomeUiState {
    data object Loading : HomeUiState
    data class Content(val summary: TodaySummary) : HomeUiState
    data class Error(val error: HomeError) : HomeUiState
}

sealed interface HomeUiEvent {
    data object RetryClicked : HomeUiEvent
    data object OpenTodayDetailsClicked : HomeUiEvent
}

enum class HomeError {
    LoadTodayFailed,
}
