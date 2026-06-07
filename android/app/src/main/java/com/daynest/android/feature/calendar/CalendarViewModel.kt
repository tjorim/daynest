package com.daynest.android.feature.calendar

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.daynest.android.core.storage.preferences.UserPreferences
import com.daynest.android.core.storage.preferences.UserPreferencesRepository
import com.daynest.android.data.calendar.CalendarDaySummaryDto
import com.daynest.android.data.calendar.CalendarRepository
import com.daynest.android.data.calendar.DeviceCalendarEvent
import com.daynest.android.data.calendar.DeviceCalendarRepository
import com.daynest.android.data.calendar.UnifiedDayItemDto
import com.daynest.android.data.today.DeleteScope
import com.daynest.android.data.today.EditScope
import com.daynest.android.data.today.PlannedItemCreateDto
import com.daynest.android.data.today.PlannedItemRepository
import com.daynest.android.data.today.PlannedItemUpdateDto
import com.daynest.android.data.today.PlannedTodayItemDto
import dagger.hilt.android.lifecycle.HiltViewModel
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
class CalendarViewModel
    @Inject
    constructor(
        private val calendarRepository: CalendarRepository,
        private val plannedItemRepository: PlannedItemRepository,
        private val deviceCalendarRepository: DeviceCalendarRepository,
        private val userPreferencesRepository: UserPreferencesRepository,
    ) : ViewModel() {
        private val _uiState = MutableStateFlow<CalendarUiState>(CalendarUiState.Loading)
        val uiState: StateFlow<CalendarUiState> = _uiState.asStateFlow()

        private val today = LocalDate.now()
        private var preferences = UserPreferences()

        private val backupHandler =
            CalendarBackupHandler(
                scope = viewModelScope,
                plannedItemRepository = plannedItemRepository,
                uiState = _uiState,
                onRefresh = ::retryCurrentMonth,
            )

        private val deviceEventsHandler =
            CalendarDeviceEventsHandler(
                scope = viewModelScope,
                deviceCalendarRepository = deviceCalendarRepository,
                userPreferencesRepository = userPreferencesRepository,
                uiState = _uiState,
                preferences = { preferences },
            )

        init {
            observePreferences()
            loadMonth(today.year, today.monthValue)
        }

        fun onEvent(event: CalendarUiEvent) {
            when (event) {
                is CalendarUiEvent.PreviousMonthClicked -> navigateMonth(-1)
                is CalendarUiEvent.NextMonthClicked -> navigateMonth(1)
                is CalendarUiEvent.DaySelected -> loadDay(event.date)
                is CalendarUiEvent.DayDeselected -> clearDay()
                is CalendarUiEvent.AddPlannedItem -> addPlannedItem(event.input)
                is CalendarUiEvent.UpdatePlannedItem ->
                    updatePlannedItem(event.id, event.date, event.input, event.scope)
                is CalendarUiEvent.DeletePlannedItem -> deletePlannedItem(event.id, event.date, event.scope)
                is CalendarUiEvent.RetryClicked -> retryCurrentMonth()
                is CalendarUiEvent.ExportMonthBackup -> backupHandler.exportMonthBackup(event.onReady)
                is CalendarUiEvent.ImportBackup -> backupHandler.importBackup(event.items)
                is CalendarUiEvent.BackupMessageChanged -> backupHandler.updateBackupMessage(event.message)
                is CalendarUiEvent.CalendarPermissionResult -> deviceEventsHandler.handlePermissionResult(event.granted)
            }
        }

        private fun observePreferences() {
            viewModelScope.launch {
                userPreferencesRepository.preferences.collect { prefs ->
                    val hadDeviceCalendars = preferences.showDeviceCalendars
                    val previousCalendarIds = preferences.enabledDeviceCalendarIds
                    preferences = prefs
                    val current = _uiState.value
                    if (current is CalendarUiState.Content) {
                        _uiState.update {
                            if (it is CalendarUiState.Content) {
                                it.copy(showDeviceCalendars = prefs.showDeviceCalendars)
                            } else {
                                it
                            }
                        }
                        val deviceCalendarPreferencesChanged =
                            hadDeviceCalendars != prefs.showDeviceCalendars ||
                                previousCalendarIds != prefs.enabledDeviceCalendarIds
                        if (current.selectedDate != null && deviceCalendarPreferencesChanged) {
                            deviceEventsHandler.load(LocalDate.parse(current.selectedDate))
                        }
                    }
                }
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
                                    showDeviceCalendars = preferences.showDeviceCalendars,
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
                        current.copy(
                            selectedDate = date,
                            isLoadingDay = true,
                            dayItems = emptyList(),
                            deviceCalendarEvents = emptyList(),
                            deviceCalendarStatus = DeviceCalendarStatus.Idle,
                        )
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
                    current.copy(selectedDate = null, dayItems = emptyList(), deviceCalendarEvents = emptyList())
                } else {
                    current
                }
            }
        }

        private fun updatePlannedItem(
            id: Int,
            date: String,
            input: PlannedItemUpdateDto,
            scope: EditScope = EditScope.THIS,
        ) {
            viewModelScope.launch {
                val result = plannedItemRepository.updatePlannedItem(id, input, scope)
                result.onSuccess { updated ->
                    if (scope == EditScope.THIS) {
                        _uiState.update { current ->
                            if (current is CalendarUiState.Content) {
                                current.withUpdatedPlannedItem(id = id, sourceDate = date, updated = updated)
                            } else {
                                current
                            }
                        }
                    } else {
                        retryCurrentMonth()
                    }
                }
            }
        }

        private fun addPlannedItem(input: PlannedItemCreateDto) {
            viewModelScope.launch {
                val result = plannedItemRepository.createPlannedItem(input)
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

        private fun deletePlannedItem(
            id: Int,
            date: String,
            scope: DeleteScope = DeleteScope.THIS,
        ) {
            viewModelScope.launch {
                val result = plannedItemRepository.deletePlannedItem(id, scope)
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
        rrule = rrule,
        recurrenceSeriesId = recurrenceSeriesId,
        recurrenceHint = recurrenceHint,
        linkedSource = linkedSource,
        linkedRef = linkedRef,
    )

private fun CalendarUiState.Content.withUpdatedPlannedItem(
    id: Int,
    sourceDate: String,
    updated: PlannedTodayItemDto,
): CalendarUiState.Content {
    val targetDate = updated.plannedFor
    val moved = sourceDate != targetDate
    return copy(
        days = days.adjustForPlannedMove(sourceDate, targetDate, displayMonth, moved),
        dayItems = dayItems.updatePlannedDayItems(id, sourceDate, targetDate, selectedDate, moved, updated),
    )
}

private fun List<CalendarDaySummaryDto>.adjustForPlannedMove(
    sourceDate: String,
    targetDate: String,
    displayMonth: LocalDate,
    moved: Boolean,
): List<CalendarDaySummaryDto> {
    if (!moved) return this
    var adjustedDays = this
    if (sourceDate.isInMonth(displayMonth)) {
        adjustedDays = adjustedDays.adjustPlannedSummary(date = sourceDate, delta = -1)
    }
    if (targetDate.isInMonth(displayMonth)) {
        adjustedDays = adjustedDays.adjustPlannedSummary(date = targetDate, delta = 1)
    }
    return adjustedDays
}

private fun List<UnifiedDayItemDto>.updatePlannedDayItems(
    id: Int,
    sourceDate: String,
    targetDate: String,
    selectedDate: String?,
    moved: Boolean,
    updated: PlannedTodayItemDto,
): List<UnifiedDayItemDto> =
    when {
        !moved && selectedDate == sourceDate -> replacePlannedItem(id, updated)
        moved && selectedDate == sourceDate -> removePlannedItem(id)
        moved && selectedDate == targetDate -> removePlannedItem(id) + updated.toUnifiedDayItem()
        else -> this
    }

private fun List<UnifiedDayItemDto>.replacePlannedItem(
    id: Int,
    updated: PlannedTodayItemDto,
): List<UnifiedDayItemDto> =
    map { item ->
        if (item.itemType == "planned" && item.itemId == id) {
            updated.toUnifiedDayItem()
        } else {
            item
        }
    }

private fun List<UnifiedDayItemDto>.removePlannedItem(id: Int): List<UnifiedDayItemDto> =
    filterNot { it.itemType == "planned" && it.itemId == id }

private fun String.isInMonth(displayMonth: LocalDate): Boolean =
    runCatching {
        val parsed = LocalDate.parse(this)
        parsed.year == displayMonth.year && parsed.month == displayMonth.month
    }.getOrDefault(false)

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
        val showDeviceCalendars: Boolean = false,
        val deviceCalendarEvents: List<DeviceCalendarEvent> = emptyList(),
        val deviceCalendarStatus: DeviceCalendarStatus = DeviceCalendarStatus.Idle,
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
        val scope: EditScope = EditScope.THIS,
    ) : CalendarUiEvent

    data class DeletePlannedItem(
        val id: Int,
        val date: String,
        val scope: DeleteScope = DeleteScope.THIS,
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

    data class CalendarPermissionResult(
        val granted: Boolean,
    ) : CalendarUiEvent
}

enum class DeviceCalendarStatus {
    Idle,
    Loading,
    Ready,
    Empty,
    NoEnabledCalendars,
    PermissionRequired,
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
    val rrule: String? = null,
    @SerialName("recurrence_hint")
    val recurrenceHint: String? = null,
    @SerialName("linked_source")
    val linkedSource: String? = null,
    @SerialName("linked_ref")
    val linkedRef: String? = null,
)
