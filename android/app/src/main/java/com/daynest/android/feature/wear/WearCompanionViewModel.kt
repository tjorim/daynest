package com.daynest.android.feature.wear

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.daynest.android.data.today.TodayRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class WearCompanionViewModel
    @Inject
    constructor(
        private val todayRepository: TodayRepository,
    ) : ViewModel() {
        private val _uiState = MutableStateFlow<WearCompanionUiState>(WearCompanionUiState.Loading)
        val uiState: StateFlow<WearCompanionUiState> = _uiState.asStateFlow()

        init {
            refresh()
        }

        fun refresh() {
            viewModelScope.launch {
                if (_uiState.value !is WearCompanionUiState.Content) {
                    _uiState.value = WearCompanionUiState.Loading
                }
                val refreshed = todayRepository.refresh()
                val today = todayRepository.getCachedTodayResponse()
                _uiState.value =
                    if (today != null) {
                        WearCompanionUiState.Content(snapshot = today.toWearTodaySnapshot(), isStale = refreshed.isFailure)
                    } else {
                        WearCompanionUiState.Error
                    }
            }
        }

        fun complete(item: WearDueItem) {
            viewModelScope.launch {
                val result =
                    when (item.type) {
                        WearDueItemType.CHORE -> todayRepository.completeChore(item.id)
                        WearDueItemType.MEDICATION -> todayRepository.takeDose(item.id)
                    }
                if (result.isSuccess) {
                    refresh()
                }
            }
        }
    }

sealed interface WearCompanionUiState {
    data object Loading : WearCompanionUiState

    data class Content(
        val snapshot: WearTodaySnapshot,
        val isStale: Boolean,
    ) : WearCompanionUiState

    data object Error : WearCompanionUiState
}
