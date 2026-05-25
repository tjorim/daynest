package com.daynest.android.feature.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.daynest.android.core.model.TodaySummary
import com.daynest.android.data.today.DueTodayItemDto
import com.daynest.android.data.today.MedicationHistoryItemDto
import com.daynest.android.data.today.MedicationTodayItemDto
import com.daynest.android.data.today.OverdueTodayItemDto
import com.daynest.android.data.today.PlannedItemRepository
import com.daynest.android.data.today.PlannedItemUpdateDto
import com.daynest.android.data.today.PlannedTodayItemDto
import com.daynest.android.data.today.RoutineTodayItemDto
import com.daynest.android.data.today.TodayRepository
import com.daynest.android.data.today.UpcomingTodayItemDto
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.LocalDate
import javax.inject.Inject

@HiltViewModel
@Suppress("TooManyFunctions")
class HomeViewModel
    @Inject
    constructor(
        private val repository: TodayRepository,
        private val plannedItemRepository: PlannedItemRepository,
    ) : ViewModel() {
        private val _uiState = MutableStateFlow<HomeUiState>(HomeUiState.Loading)
        private val _effects = MutableSharedFlow<HomeUiEffect>()
        private var latestPendingMutationCount = 0

        val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()
        val effects: SharedFlow<HomeUiEffect> = _effects.asSharedFlow()

        init {
            viewModelScope.launch {
                repository.observeTodaySummary().collect { summary ->
                    _uiState.update { current ->
                        if (summary == null) {
                            current
                        } else {
                            when (val c = current) {
                                is HomeUiState.Content -> c.copy(summary = summary, isStale = false)
                                else ->
                                    HomeUiState.Content(
                                        summary = summary,
                                        isStale = false,
                                        pendingMutationCount = latestPendingMutationCount,
                                    )
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
                                        selectedChoreIds =
                                            c.selectedChoreIds.intersect(
                                                (
                                                    response.overdue.map { it.choreInstanceId } +
                                                        response.dueToday.map { it.choreInstanceId }
                                                ).toSet(),
                                            ),
                                        selectedRoutineIds =
                                            c.selectedRoutineIds.intersect(
                                                response.routines.map { it.taskInstanceId }.toSet(),
                                            ),
                                        selectedPlannedIds =
                                            c.selectedPlannedIds.intersect(response.planned.map { it.id }.toSet()),
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
                                        pendingMutationCount = latestPendingMutationCount,
                                    )
                            }
                        }
                    }
                }
            }
            viewModelScope.launch {
                repository.observePendingMutationCount().collect { count ->
                    latestPendingMutationCount = count
                    _uiState.update { current ->
                        when (current) {
                            is HomeUiState.Content -> current.copy(pendingMutationCount = count)
                            else -> current
                        }
                    }
                }
            }
            viewModelScope.launch {
                repository.observeSyncNotices().collect { notices ->
                    notices.forEach { notice ->
                        _effects.emit(HomeUiEffect.ShowSnackbar(notice.message))
                        repository.markSyncNoticeConsumed(notice.id)
                    }
                }
            }
            refresh()
        }

        @Suppress("CyclomaticComplexMethod")
        fun onEvent(event: HomeUiEvent) {
            when (event) {
                HomeUiEvent.RetryClicked -> refresh()
                HomeUiEvent.RefreshRequested -> refresh()
                is HomeUiEvent.CompleteChoreClicked -> choreAction(event.choreInstanceId, complete = true)
                is HomeUiEvent.SkipChoreClicked -> choreAction(event.choreInstanceId, complete = false)
                is HomeUiEvent.CompleteTaskClicked -> taskAction(event.taskInstanceId, complete = true)
                is HomeUiEvent.StartTaskClicked -> startTask(event.taskInstanceId)
                is HomeUiEvent.SkipTaskClicked -> taskAction(event.taskInstanceId, complete = false)
                is HomeUiEvent.RescheduleChoreClicked -> rescheduleChore(event.choreInstanceId, event.scheduledDate)
                is HomeUiEvent.SnoozeChoreClicked -> snoozeChore(event.choreInstanceId)
                is HomeUiEvent.ToggleSelection -> toggleSelection(event.type, event.id)
                is HomeUiEvent.SelectAll -> selectAll(event.type, event.ids)
                is HomeUiEvent.ClearSelection -> clearSelection(event.type)
                is HomeUiEvent.BulkDone -> bulkDone(event.type)
                is HomeUiEvent.BulkSkip -> bulkSkip(event.type)
                is HomeUiEvent.BulkUndo -> bulkUndo(event.type)
                is HomeUiEvent.TakeMedicationClicked -> doseAction(event.doseInstanceId, take = true)
                is HomeUiEvent.SkipMedicationClicked -> doseAction(event.doseInstanceId, take = false)
                is HomeUiEvent.MarkPlannedDoneClicked -> markPlannedDone(event.id, event.isDone)
                is HomeUiEvent.UpdatePlannedClicked -> updatePlanned(event.item)
                is HomeUiEvent.DeletePlannedClicked -> deletePlanned(event.id, event.scope)
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

        private fun rescheduleChore(
            id: Int,
            scheduledDate: String,
        ) {
            viewModelScope.launch {
                val result = repository.rescheduleChore(id, scheduledDate)
                if (result.isSuccess) refresh()
            }
        }

        private fun toggleSelection(
            type: SectionType,
            id: Int,
        ) {
            _uiState.update { current ->
                if (current is HomeUiState.Content) {
                    when (type) {
                        SectionType.CHORES ->
                            current.copy(
                                selectedChoreIds = current.selectedChoreIds.toggle(id),
                            )
                        SectionType.ROUTINES ->
                            current.copy(
                                selectedRoutineIds = current.selectedRoutineIds.toggle(id),
                            )
                        SectionType.PLANNED ->
                            current.copy(
                                selectedPlannedIds = current.selectedPlannedIds.toggle(id),
                            )
                    }
                } else {
                    current
                }
            }
        }

        private fun selectAll(
            type: SectionType,
            ids: List<Int>,
        ) {
            _uiState.update { current ->
                if (current is HomeUiState.Content) {
                    when (type) {
                        SectionType.CHORES -> current.copy(selectedChoreIds = ids.toSet())
                        SectionType.ROUTINES -> current.copy(selectedRoutineIds = ids.toSet())
                        SectionType.PLANNED -> current.copy(selectedPlannedIds = ids.toSet())
                    }
                } else {
                    current
                }
            }
        }

        private fun clearSelection(type: SectionType) {
            _uiState.update { current ->
                if (current is HomeUiState.Content) {
                    when (type) {
                        SectionType.CHORES -> current.copy(selectedChoreIds = emptySet())
                        SectionType.ROUTINES -> current.copy(selectedRoutineIds = emptySet())
                        SectionType.PLANNED -> current.copy(selectedPlannedIds = emptySet())
                    }
                } else {
                    current
                }
            }
        }

        private fun bulkDone(type: SectionType) {
            val content = _uiState.value as? HomeUiState.Content ?: return
            val ids =
                when (type) {
                    SectionType.CHORES -> content.selectedChoreIds.toList()
                    SectionType.ROUTINES -> content.selectedRoutineIds.toList()
                    SectionType.PLANNED -> emptyList()
                }
            if (ids.isEmpty()) return
            viewModelScope.launch {
                val deferred =
                    ids.map { id ->
                        async {
                            when (type) {
                                SectionType.CHORES -> repository.completeChore(id)
                                SectionType.ROUTINES -> repository.completeTask(id)
                                SectionType.PLANNED ->
                                    Result.failure(IllegalStateException("Bulk done not supported for PLANNED"))
                            }
                        }
                    }
                deferred.awaitAll()
                clearSelection(type)
                refresh()
            }
        }

        private fun bulkSkip(type: SectionType) {
            val content = _uiState.value as? HomeUiState.Content ?: return
            val ids =
                when (type) {
                    SectionType.CHORES -> content.selectedChoreIds.toList()
                    SectionType.ROUTINES -> content.selectedRoutineIds.toList()
                    SectionType.PLANNED -> emptyList()
                }
            if (ids.isEmpty()) return
            viewModelScope.launch {
                val deferred =
                    ids.map { id ->
                        async {
                            when (type) {
                                SectionType.CHORES -> repository.skipChore(id)
                                SectionType.ROUTINES -> repository.skipTask(id)
                                SectionType.PLANNED ->
                                    Result.failure(IllegalStateException("Bulk skip not supported for PLANNED"))
                            }
                        }
                    }
                deferred.awaitAll()
                clearSelection(type)
                refresh()
            }
        }

        private fun bulkUndo(type: SectionType) {
            val content =
                (_uiState.value as? HomeUiState.Content)
                    ?.takeIf { type == SectionType.PLANNED } ?: return
            val ids = content.selectedPlannedIds.toList()
            if (ids.isEmpty()) return
            viewModelScope.launch {
                val deferred =
                    ids.map { id ->
                        async {
                            val item =
                                content.planned.firstOrNull { it.id == id }
                                    ?: return@async Result.failure<Unit>(
                                        IllegalStateException("Planned item $id not found"),
                                    )
                            plannedItemRepository.markPlannedDone(id, item, false)
                        }
                    }
                deferred.awaitAll()
                clearSelection(SectionType.PLANNED)
                refresh()
            }
        }

        private fun snoozeChore(id: Int) {
            viewModelScope.launch {
                val tomorrow = LocalDate.now().plusDays(1).toString()
                val result = repository.rescheduleChore(id, tomorrow)
                if (result.isSuccess) refresh()
            }
        }

        private fun startTask(id: Int) {
            viewModelScope.launch {
                val result = repository.startTask(id)
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

        private fun updatePlanned(item: PlannedTodayItemDto) {
            viewModelScope.launch {
                val result = plannedItemRepository.updatePlannedItem(item.id, item.toUpdateDto())
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
                val result = plannedItemRepository.markPlannedDone(id, currentPlanned, isDone)
                if (result.isSuccess) refresh()
            }
        }

        private fun deletePlanned(
            id: Int,
            scope: String = "this",
        ) {
            viewModelScope.launch {
                val result = plannedItemRepository.deletePlannedItem(id, scope)
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
        val pendingMutationCount: Int = 0,
        val selectedChoreIds: Set<Int> = emptySet(),
        val selectedRoutineIds: Set<Int> = emptySet(),
        val selectedPlannedIds: Set<Int> = emptySet(),
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

    data class StartTaskClicked(
        val taskInstanceId: Int,
    ) : HomeUiEvent

    data class SkipTaskClicked(
        val taskInstanceId: Int,
    ) : HomeUiEvent

    data class RescheduleChoreClicked(
        val choreInstanceId: Int,
        val scheduledDate: String,
    ) : HomeUiEvent

    data class SnoozeChoreClicked(
        val choreInstanceId: Int,
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

    data class UpdatePlannedClicked(
        val item: PlannedTodayItemDto,
    ) : HomeUiEvent

    data class DeletePlannedClicked(
        val id: Int,
        val scope: String = "this",
    ) : HomeUiEvent

    data class ToggleSelection(
        val type: SectionType,
        val id: Int,
    ) : HomeUiEvent

    data class SelectAll(
        val type: SectionType,
        val ids: List<Int>,
    ) : HomeUiEvent

    data class ClearSelection(
        val type: SectionType,
    ) : HomeUiEvent

    data class BulkDone(
        val type: SectionType,
    ) : HomeUiEvent

    data class BulkSkip(
        val type: SectionType,
    ) : HomeUiEvent

    data class BulkUndo(
        val type: SectionType,
    ) : HomeUiEvent
}

sealed interface HomeUiEffect {
    data class ShowSnackbar(
        val message: String,
    ) : HomeUiEffect
}

enum class SectionType { CHORES, ROUTINES, PLANNED }

private fun Set<Int>.toggle(id: Int): Set<Int> = if (contains(id)) this - id else this + id

private fun PlannedTodayItemDto.toUpdateDto() =
    PlannedItemUpdateDto(
        title = title,
        plannedFor = plannedFor,
        isDone = isDone,
        notes = notes,
        moduleKey = moduleKey,
        rrule = rrule,
        recurrenceHint = recurrenceHint,
        linkedSource = linkedSource,
        linkedRef = linkedRef,
    )

enum class HomeError {
    LoadTodayFailed,
}
