package com.daynest.android.feature.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.daynest.android.core.model.TodaySummary
import com.daynest.android.data.today.DueTodayItemDto
import com.daynest.android.data.today.MedicationHistoryItemDto
import com.daynest.android.data.today.MedicationTodayItemDto
import com.daynest.android.data.today.OverdueTodayItemDto
import com.daynest.android.data.today.PlannedTodayItemDto
import com.daynest.android.data.today.RoutineTodayItemDto
import com.daynest.android.data.today.TodayRepository
import com.daynest.android.data.today.UpcomingTodayItemDto
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
                            when (val c = current) {
                                is HomeUiState.Content -> c.copy(summary = summary, isStale = false)
                                else -> HomeUiState.Content(summary = summary, isStale = false)
                            }
                        }
                    }
                }
            }
            viewModelScope.launch {
                repository.observeTodayResponse().collect { response ->
                    if (response != null) {
                        _uiState.update { current ->
                            when (val c = current) {
                                is HomeUiState.Content ->
                                    c.copy(
                                        medication = response.medication,
                                        medicationHistory = response.medicationHistory,
                                        routines = response.routines,
                                        overdue = response.overdue,
                                        dueToday = response.dueToday,
                                        upcoming = response.upcoming,
                                        planned = response.planned,
                                        isStale = false,
                                    )
                                else ->
                                    HomeUiState.Content(
                                        summary =
                                            TodaySummary(
                                                routinesCount = response.routines.size,
                                                choresCount = response.dueToday.size + response.overdue.size,
                                                medicationsCount = response.medication.size,
                                                plannedPendingCount = response.planned.count { !it.isDone },
                                            ),
                                        medication = response.medication,
                                        medicationHistory = response.medicationHistory,
                                        routines = response.routines,
                                        overdue = response.overdue,
                                        dueToday = response.dueToday,
                                        upcoming = response.upcoming,
                                        planned = response.planned,
                                    )
                            }
                        }
                    }
                }
            }
            refresh()
        }

        fun onEvent(event: HomeUiEvent) {
            when (event) {
                HomeUiEvent.RetryClicked -> refresh()
                HomeUiEvent.RefreshRequested -> refresh()
                is HomeUiEvent.CompleteChoreClicked -> choreAction(event.choreInstanceId, complete = true)
                is HomeUiEvent.SkipChoreClicked -> choreAction(event.choreInstanceId, complete = false)
                is HomeUiEvent.CompleteTaskClicked -> taskAction(event.taskInstanceId, complete = true)
                is HomeUiEvent.SkipTaskClicked -> taskAction(event.taskInstanceId, complete = false)
                is HomeUiEvent.TakeMedicationClicked -> doseAction(event.doseInstanceId, take = true)
                is HomeUiEvent.SkipMedicationClicked -> doseAction(event.doseInstanceId, take = false)
                is HomeUiEvent.MarkPlannedDoneClicked -> markPlannedDone(event.id, event.isDone)
                is HomeUiEvent.DeletePlannedClicked -> deletePlanned(event.id)
            }
        }

        private fun choreAction(
            id: Int,
            complete: Boolean,
        ) {
            viewModelScope.launch {
                val result = if (complete) repository.completeChore(id) else repository.skipChore(id)
                if (result.isSuccess) refresh()
            }
        }

        private fun taskAction(
            id: Int,
            complete: Boolean,
        ) {
            viewModelScope.launch {
                val result = if (complete) repository.completeTask(id) else repository.skipTask(id)
                if (result.isSuccess) refresh()
            }
        }

        private fun doseAction(
            id: Int,
            take: Boolean,
        ) {
            viewModelScope.launch {
                val result = if (take) repository.takeDose(id) else repository.skipDose(id)
                if (result.isSuccess) refresh()
            }
        }

        private fun markPlannedDone(
            id: Int,
            isDone: Boolean,
        ) {
            val currentPlanned =
                (_uiState.value as? HomeUiState.Content)
                    ?.planned
                    ?.firstOrNull { it.id == id }
                    ?: return
            viewModelScope.launch {
                val result = repository.markPlannedDone(id, currentPlanned, isDone)
                if (result.isSuccess) refresh()
            }
        }

        private fun deletePlanned(id: Int) {
            viewModelScope.launch {
                val result = repository.deletePlannedItem(id)
                if (result.isSuccess) {
                    _uiState.update { current ->
                        if (current is HomeUiState.Content) {
                            val deletedItem = current.planned.firstOrNull { it.id == id }
                            val wasPending = deletedItem?.isDone == false
                            current.copy(
                                planned = current.planned.filter { it.id != id },
                                summary =
                                    if (wasPending) {
                                        current.summary.copy(
                                            plannedPendingCount = maxOf(0, current.summary.plannedPendingCount - 1),
                                        )
                                    } else {
                                        current.summary
                                    },
                            )
                        } else {
                            current
                        }
                    }
                }
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
        val medication: List<MedicationTodayItemDto> = emptyList(),
        val medicationHistory: List<MedicationHistoryItemDto> = emptyList(),
        val routines: List<RoutineTodayItemDto> = emptyList(),
        val overdue: List<OverdueTodayItemDto> = emptyList(),
        val dueToday: List<DueTodayItemDto> = emptyList(),
        val upcoming: List<UpcomingTodayItemDto> = emptyList(),
        val planned: List<PlannedTodayItemDto> = emptyList(),
        val isStale: Boolean = false,
    ) : HomeUiState

    data class Error(
        val error: HomeError,
    ) : HomeUiState
}

sealed interface HomeUiEvent {
    data object RetryClicked : HomeUiEvent

    data object RefreshRequested : HomeUiEvent

    data class CompleteChoreClicked(
        val choreInstanceId: Int,
    ) : HomeUiEvent

    data class SkipChoreClicked(
        val choreInstanceId: Int,
    ) : HomeUiEvent

    data class CompleteTaskClicked(
        val taskInstanceId: Int,
    ) : HomeUiEvent

    data class SkipTaskClicked(
        val taskInstanceId: Int,
    ) : HomeUiEvent

    data class TakeMedicationClicked(
        val doseInstanceId: Int,
    ) : HomeUiEvent

    data class SkipMedicationClicked(
        val doseInstanceId: Int,
    ) : HomeUiEvent

    data class MarkPlannedDoneClicked(
        val id: Int,
        val isDone: Boolean,
    ) : HomeUiEvent

    data class DeletePlannedClicked(
        val id: Int,
    ) : HomeUiEvent
}

enum class HomeError {
    LoadTodayFailed,
}
