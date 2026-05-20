package com.daynest.android.feature.calendar

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.daynest.android.data.calendar.CalendarDaySummaryDto
import com.daynest.android.data.calendar.CalendarRepository
import com.daynest.android.data.calendar.UnifiedDayItemDto
import com.daynest.android.data.today.PlannedItemCreateDto
import com.daynest.android.data.today.PlannedItemUpdateDto
import com.daynest.android.data.today.PlannedTodayItemDto
import com.daynest.android.data.today.TodayRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.time.LocalDate
import javax.inject.Inject

@HiltViewModel
@Suppress("TooManyFunctions")
class CalendarViewModel
    @Inject
    constructor(
        private val calendarRepository: CalendarRepository,
        private val todayRepository: TodayRepository,
    ) : ViewModel() {
        private val _uiState = MutableStateFlow<CalendarUiState>(CalendarUiState.Loading)
        val uiState: StateFlow<CalendarUiState> = _uiState.asStateFlow()

        private val today = LocalDate.now()

        init {
            loadMonth(today.year, today.monthValue)
        }

        fun onEvent(event: CalendarUiEvent) {
            when (event) {
                is CalendarUiEvent.PreviousMonthClicked -> navigateMonth(-1)
                is CalendarUiEvent.NextMonthClicked -> navigateMonth(1)
                is CalendarUiEvent.DaySelected -> loadDay(event.date)
                is CalendarUiEvent.DayDeselected -> clearDay()
                is CalendarUiEvent.AddPlannedItem -> addPlannedItem(event.input)
                is CalendarUiEvent.UpdatePlannedItem -> updatePlannedItem(event.id, event.date, event.input)
                is CalendarUiEvent.DeletePlannedItem -> deletePlannedItem(event.id, event.date)
                is CalendarUiEvent.RetryClicked -> retryCurrentMonth()
                is CalendarUiEvent.ExportMonthBackup -> exportMonthBackup(event.onReady)
                is CalendarUiEvent.ImportBackup -> importBackup(event.items)
                is CalendarUiEvent.BackupMessageChanged -> updateBackupMessage(event.message)
            }
        }

        private fun navigateMonth(delta: Int) {
            val current = _uiState.value
            if (current is CalendarUiState.Content) {
                val newMonth = current.displayMonth.plusMonths(delta.toLong())
                loadMonth(newMonth.year, newMonth.monthValue)
            }
        }

        private fun retryCurrentMonth() {
            val current = _uiState.value
            val month =
                if (current is CalendarUiState.Content) {
                    current.displayMonth
                } else {
                    LocalDate.of(today.year, today.monthValue, 1)
                }
            loadMonth(month.year, month.monthValue)
        }

        private fun loadMonth(
            year: Int,
            month: Int,
        ) {
            viewModelScope.launch {
                val displayMonth = LocalDate.of(year, month, 1)
                _uiState.update { current ->
                    if (current is CalendarUiState.Content) {
                        current.copy(isLoadingMonth = true, displayMonth = displayMonth)
                    } else {
                        CalendarUiState.Loading
                    }
                }
                val result = calendarRepository.getMonth(year, month)
                result
                    .onSuccess { monthDto ->
                        _uiState.update { current ->
                            val currentMonth =
                                when (current) {
                                    is CalendarUiState.Content -> current.displayMonth
                                    is CalendarUiState.Error -> current.displayMonth
                                    else -> null
                                }
                            if (currentMonth == null || currentMonth == displayMonth) {
                                CalendarUiState.Content(
                                    displayMonth = displayMonth,
                                    days = monthDto.days,
                                    selectedDate = null,
                                    dayItems = emptyList(),
                                    isLoadingMonth = false,
                                    isLoadingDay = false,
                                )
                            } else {
                                current
                            }
                        }
                    }.onFailure {
                        _uiState.update { current ->
                            val currentMonth =
                                when (current) {
                                    is CalendarUiState.Content -> current.displayMonth
                                    is CalendarUiState.Error -> current.displayMonth
                                    else -> null
                                }
                            if (currentMonth == null || currentMonth == displayMonth) {
                                CalendarUiState.Error(displayMonth = displayMonth)
                            } else {
                                current
                            }
                        }
                    }
            }
        }

        private fun loadDay(date: String) {
            viewModelScope.launch {
                _uiState.update { current ->
                    if (current is CalendarUiState.Content) {
                        current.copy(selectedDate = date, isLoadingDay = true, dayItems = emptyList())
                    } else {
                        current
                    }
                }
                val result = calendarRepository.getDay(date)
                result
                    .onSuccess { dayDto ->
                        _uiState.update { current ->
                            if (current is CalendarUiState.Content && current.selectedDate == date) {
                                current.copy(dayItems = dayDto.items, isLoadingDay = false)
                            } else {
                                current
                            }
                        }
                    }.onFailure {
                        _uiState.update { current ->
                            if (current is CalendarUiState.Content && current.selectedDate == date) {
                                current.copy(isLoadingDay = false)
                            } else {
                                current
                            }
                        }
                    }
            }
        }

        private fun clearDay() {
            _uiState.update { current ->
                if (current is CalendarUiState.Content) {
                    current.copy(selectedDate = null, dayItems = emptyList())
                } else {
                    current
                }
            }
        }

        private fun updatePlannedItem(
            id: Int,
            date: String,
            input: PlannedItemUpdateDto,
        ) {
            viewModelScope.launch {
                val result = todayRepository.updatePlannedItem(id, input)
                result.onSuccess { updated ->
                    _uiState.update { current ->
                        if (current is CalendarUiState.Content && current.selectedDate == date) {
                            current.copy(
                                dayItems =
                                    current.dayItems.map { item ->
                                        if (item.itemType == "planned" && item.itemId == id) {
                                            item.copy(
                                                title = updated.title,
                                                status = if (updated.isDone) "done" else "planned",
                                                detail = updated.notes,
                                                moduleKey = updated.moduleKey,
                                                recurrenceHint = updated.recurrenceHint,
                                                linkedSource = updated.linkedSource,
                                                linkedRef = updated.linkedRef,
                                            )
                                        } else {
                                            item
                                        }
                                    },
                            )
                        } else {
                            current
                        }
                    }
                }
            }
        }

        private fun addPlannedItem(input: PlannedItemCreateDto) {
            viewModelScope.launch {
                val result = todayRepository.createPlannedItem(input)
                result.onSuccess { plannedItem ->
                    _uiState.update { current ->
                        if (current is CalendarUiState.Content) {
                            current.copy(
                                days = current.days.adjustPlannedSummary(date = input.plannedFor, delta = 1),
                                dayItems =
                                    if (current.selectedDate == input.plannedFor) {
                                        current.dayItems + plannedItem.toUnifiedDayItem()
                                    } else {
                                        current.dayItems
                                    },
                            )
                        } else {
                            current
                        }
                    }
                }
            }
        }

        private fun exportMonthBackup(onReady: (PlannedItemBackupDto) -> Unit) {
            val current = _uiState.value as? CalendarUiState.Content ?: return
            val startDate = current.displayMonth.withDayOfMonth(1).toString()
            val endDate = current.displayMonth.withDayOfMonth(current.displayMonth.lengthOfMonth()).toString()
            viewModelScope.launch {
                val result = todayRepository.listPlannedItems(startDate, endDate)
                result.onSuccess { items ->
                    onReady(
                        PlannedItemBackupDto(
                            source = "daynest",
                            schemaVersion = 1,
                            exportedAt = java.time.Instant.now().toString(),
                            items = items.map { it.toBackupItem() },
                        ),
                    )
                }
            }
        }

        private fun importBackup(items: List<PlannedItemCreateDto>) {
            viewModelScope.launch {
                val results =
                    items.chunked(5).flatMap { batch ->
                        batch
                            .map { item -> async { todayRepository.createPlannedItem(item) } }
                            .awaitAll()
                    }
                val imported = results.count { it.isSuccess }
                val failed = results.count { it.isFailure }
                _uiState.update { current ->
                    if (current is CalendarUiState.Content) {
                        current.copy(backupMessage = CalendarBackupMessage.ImportComplete(imported, failed))
                    } else {
                        current
                    }
                }
                retryCurrentMonth()
            }
        }

        private fun updateBackupMessage(message: CalendarBackupMessage) {
            _uiState.update { current ->
                if (current is CalendarUiState.Content) {
                    current.copy(backupMessage = message)
                } else {
                    current
                }
            }
        }

        private fun deletePlannedItem(
            id: Int,
            date: String,
        ) {
            viewModelScope.launch {
                val result = todayRepository.deletePlannedItem(id)
                if (result.isSuccess) {
                    _uiState.update { current ->
                        if (current is CalendarUiState.Content) {
                            current.copy(
                                days = current.days.adjustPlannedSummary(date = date, delta = -1),
                                dayItems =
                                    if (current.selectedDate == date) {
                                        current.dayItems.filterNot { it.itemType == "planned" && it.itemId == id }
                                    } else {
                                        current.dayItems
                                    },
                            )
                        } else {
                            current
                        }
                    }
                }
            }
        }
    }

private fun PlannedTodayItemDto.toUnifiedDayItem() =
    UnifiedDayItemDto(
        itemType = "planned",
        itemId = id,
        title = title,
        status = if (isDone) "done" else "planned",
        scheduledDate = plannedFor,
        detail = notes,
        moduleKey = moduleKey,
    )

private fun PlannedTodayItemDto.toBackupItem() =
    PlannedItemBackupItemDto(
        title = title,
        plannedFor = plannedFor,
        notes = notes,
        moduleKey = moduleKey,
        recurrenceHint = recurrenceHint,
        linkedSource = linkedSource,
        linkedRef = linkedRef,
    )

private fun List<CalendarDaySummaryDto>.adjustPlannedSummary(
    date: String,
    delta: Int,
): List<CalendarDaySummaryDto> {
    val existing = firstOrNull { it.date == date }
    if (existing == null) {
        return if (delta > 0) {
            (
                this +
                    CalendarDaySummaryDto(
                        date = date,
                        total = delta,
                        routines = 0,
                        chores = 0,
                        medications = 0,
                        planned = delta,
                    )
            ).sortedBy { it.date }
        } else {
            this
        }
    }

    val newPlanned = (existing.planned + delta).coerceAtLeast(0)
    val actualDelta = newPlanned - existing.planned
    val updated =
        existing.copy(
            total = (existing.total + actualDelta).coerceAtLeast(0),
            planned = newPlanned,
        )
    return if (updated.total == 0) {
        filterNot { it.date == date }
    } else {
        map { if (it.date == date) updated else it }
    }
}

sealed interface CalendarUiState {
    data object Loading : CalendarUiState

    data class Content(
        val displayMonth: LocalDate,
        val days: List<CalendarDaySummaryDto>,
        val selectedDate: String?,
        val dayItems: List<UnifiedDayItemDto>,
        val isLoadingMonth: Boolean,
        val isLoadingDay: Boolean,
        val backupMessage: CalendarBackupMessage? = null,
    ) : CalendarUiState

    data class Error(
        val displayMonth: LocalDate,
    ) : CalendarUiState
}

sealed interface CalendarUiEvent {
    data object PreviousMonthClicked : CalendarUiEvent

    data object NextMonthClicked : CalendarUiEvent

    data class DaySelected(
        val date: String,
    ) : CalendarUiEvent

    data object DayDeselected : CalendarUiEvent

    data class AddPlannedItem(
        val input: PlannedItemCreateDto,
    ) : CalendarUiEvent

    data class UpdatePlannedItem(
        val id: Int,
        val date: String,
        val input: PlannedItemUpdateDto,
    ) : CalendarUiEvent

    data class DeletePlannedItem(
        val id: Int,
        val date: String,
    ) : CalendarUiEvent

    data object RetryClicked : CalendarUiEvent

    data class ExportMonthBackup(
        val onReady: (PlannedItemBackupDto) -> Unit,
    ) : CalendarUiEvent

    data class ImportBackup(
        val items: List<PlannedItemCreateDto>,
    ) : CalendarUiEvent

    data class BackupMessageChanged(
        val message: CalendarBackupMessage,
    ) : CalendarUiEvent
}

sealed interface CalendarBackupMessage {
    data object InvalidImport : CalendarBackupMessage

    data class ImportComplete(
        val imported: Int,
        val failed: Int,
    ) : CalendarBackupMessage
}

@Serializable
data class PlannedItemBackupDto(
    val source: String,
    @SerialName("schema_version")
    val schemaVersion: Int,
    @SerialName("exported_at")
    val exportedAt: String,
    val items: List<PlannedItemBackupItemDto>,
)

@Serializable
data class PlannedItemBackupItemDto(
    val title: String,
    @SerialName("planned_for")
    val plannedFor: String,
    val notes: String? = null,
    @SerialName("module_key")
    val moduleKey: String? = null,
    @SerialName("recurrence_hint")
    val recurrenceHint: String? = null,
    @SerialName("linked_source")
    val linkedSource: String? = null,
    @SerialName("linked_ref")
    val linkedRef: String? = null,
)
