package com.daynest.android.feature.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.daynest.android.core.model.TodaySummary
import com.daynest.android.data.today.TodayRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val repository: TodayRepository,
) : ViewModel() {
    private val _state = MutableStateFlow<HomeUiState>(HomeUiState.Loading)

    val state = _state.asStateFlow()

    init {
        refreshToday()
    }

    fun refreshToday() {
        viewModelScope.launch {
            _state.value = HomeUiState.Loading

            _state.value = runCatching { repository.getTodaySummary() }
                .fold(
                    onSuccess = { HomeUiState.Success(it) },
                    onFailure = { HomeUiState.Error(HomeError.LoadTodayFailed) },
                )
        }
    }
}

sealed interface HomeUiState {
    data object Loading : HomeUiState
    data class Success(val summary: TodaySummary) : HomeUiState
    data class Error(val error: HomeError) : HomeUiState
}

enum class HomeError {
    LoadTodayFailed,
}
