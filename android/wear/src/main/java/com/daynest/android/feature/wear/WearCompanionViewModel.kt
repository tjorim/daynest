package com.daynest.android.feature.wear

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.daynest.android.data.today.TodayRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

@HiltViewModel
class WearCompanionViewModel
@Inject
constructor(private val todayRepository: TodayRepository) : ViewModel() {
    private val _uiState = MutableStateFlow<WearCompanionUiState>(WearCompanionUiState.Loading)
    private val refreshMutex = Mutex()
    private val inFlightMutex = Mutex()
    private val inFlightMutations = mutableSetOf<WearDueItemMutation>()
    val uiState: StateFlow<WearCompanionUiState> = _uiState.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            refreshMutex.withLock {
                val cachedToday = todayRepository.getCachedTodayResponse()
                if (cachedToday != null) {
                    _uiState.value =
                        WearCompanionUiState.Content(
                            snapshot = cachedToday.toWearTodaySnapshot(),
                            isStale = false
                        )
                } else {
                    _uiState.value = WearCompanionUiState.Loading
                }
                val refreshed = todayRepository.refresh()
                val today = todayRepository.getCachedTodayResponse()
                _uiState.value =
                    if (today != null) {
                        WearCompanionUiState.Content(
                            snapshot = today.toWearTodaySnapshot(),
                            isStale = refreshed.isFailure
                        )
                    } else {
                        WearCompanionUiState.Error
                    }
            }
        }
    }

    fun complete(item: WearDueItem) {
        val mutation = WearDueItemMutation(item.type, item.id)
        viewModelScope.launch {
            val shouldRun =
                inFlightMutex.withLock {
                    if (mutation in inFlightMutations) {
                        false
                    } else {
                        inFlightMutations += mutation
                        true
                    }
                }
            if (!shouldRun) {
                return@launch
            }

            try {
                val result =
                    when (item.type) {
                        WearDueItemType.CHORE -> todayRepository.completeChore(item.id)
                        WearDueItemType.MEDICATION -> todayRepository.takeDose(item.id)
                    }
                if (result.isSuccess) {
                    refresh()
                }
            } finally {
                inFlightMutex.withLock {
                    inFlightMutations -= mutation
                }
            }
        }
    }
}

private data class WearDueItemMutation(val type: WearDueItemType, val id: Int)

sealed interface WearCompanionUiState {
    data object Loading : WearCompanionUiState

    data class Content(val snapshot: WearTodaySnapshot, val isStale: Boolean) : WearCompanionUiState

    data object Error : WearCompanionUiState
}
