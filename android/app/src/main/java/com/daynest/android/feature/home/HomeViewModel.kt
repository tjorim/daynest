package com.daynest.android.feature.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.daynest.android.core.model.TodoSummaryUiModel
import com.daynest.android.core.model.toTodoSummaryUiModel
import com.daynest.android.core.network.NetworkModule
import com.daynest.android.data.today.TodayRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class HomeViewModel(
    private val repository: TodayRepository = TodayRepository(NetworkModule.todayApi),
) : ViewModel() {
    private val _state = MutableStateFlow<HomeUiState>(HomeUiState.Loading)

    val state = _state.asStateFlow()

    init {
        refreshToday()
    }

    fun refreshToday() {
        viewModelScope.launch {
            _state.value = HomeUiState.Loading

            _state.value = runCatching {
                repository.getTodaySummary().toTodoSummaryUiModel()
            }
                .fold(
                    onSuccess = { HomeUiState.Success(it) },
                    onFailure = { HomeUiState.Error(it.message ?: "Unable to load today data.") },
                )
        }
    }
}

sealed interface HomeUiState {
    data object Loading : HomeUiState
    data class Success(val summary: TodoSummaryUiModel) : HomeUiState
    data class Error(val message: String) : HomeUiState
}
