package com.daynest.android.feature.stats

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.daynest.android.data.analytics.AnalyticsRepository
import com.daynest.android.data.analytics.AnalyticsSummaryDto
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

@HiltViewModel
class StatsViewModel
@Inject
constructor(private val analyticsRepository: AnalyticsRepository) : ViewModel() {
    private val _uiState = MutableStateFlow<StatsUiState>(StatsUiState.Loading)
    val uiState: StateFlow<StatsUiState> = _uiState.asStateFlow()

    init {
        load(StatsPeriod.WEEK)
    }

    fun onEvent(event: StatsUiEvent) {
        when (event) {
            is StatsUiEvent.PeriodSelected -> load(event.period)
            StatsUiEvent.RetryClicked -> {
                val period = (_uiState.value as? StatsUiState.Content)?.period ?: StatsPeriod.WEEK
                load(period)
            }
        }
    }

    private fun load(period: StatsPeriod) {
        viewModelScope.launch {
            _uiState.value = StatsUiState.Loading
            analyticsRepository.getSummary(period.apiValue).fold(
                onSuccess = { summary -> _uiState.value = StatsUiState.Content(period, summary) },
                onFailure = { _uiState.value = StatsUiState.Error }
            )
        }
    }
}

enum class StatsPeriod(val apiValue: String) {
    WEEK("week"),
    MONTH("month"),
    YEAR("year")
}

sealed interface StatsUiState {
    data object Loading : StatsUiState

    data class Content(val period: StatsPeriod, val summary: AnalyticsSummaryDto) : StatsUiState

    data object Error : StatsUiState
}

sealed interface StatsUiEvent {
    data class PeriodSelected(val period: StatsPeriod) : StatsUiEvent

    data object RetryClicked : StatsUiEvent
}
