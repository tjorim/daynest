package com.daynest.android.feature.calendar

import com.daynest.android.core.storage.preferences.UserPreferences
import com.daynest.android.core.storage.preferences.UserPreferencesRepository
import com.daynest.android.data.calendar.DeviceCalendarRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.LocalDate

internal class CalendarDeviceEventsHandler(
    private val scope: CoroutineScope,
    private val deviceCalendarRepository: DeviceCalendarRepository,
    private val userPreferencesRepository: UserPreferencesRepository,
    private val uiState: MutableStateFlow<CalendarUiState>,
    private val preferences: () -> UserPreferences,
) {
    fun load(date: LocalDate) {
        scope.launch {
            if (!preferences().showDeviceCalendars) {
                updateContent {
                    it.copy(
                        deviceCalendarEvents = emptyList(),
                        deviceCalendarStatus = DeviceCalendarStatus.Idle,
                    )
                }
                return@launch
            }
            if (preferences().enabledDeviceCalendarIds.isEmpty()) {
                updateContent {
                    it.copy(
                        deviceCalendarEvents = emptyList(),
                        deviceCalendarStatus = DeviceCalendarStatus.NoEnabledCalendars,
                    )
                }
                return@launch
            }
            updateContent { it.copy(deviceCalendarStatus = DeviceCalendarStatus.Loading) }
            deviceCalendarRepository
                .listEventsForDay(date, preferences().enabledDeviceCalendarIds)
                .onSuccess { events ->
                    updateContent { current ->
                        if (current.selectedDate != date.toString()) return@updateContent current
                        current.copy(
                            deviceCalendarEvents = events,
                            deviceCalendarStatus =
                                if (events.isEmpty()) DeviceCalendarStatus.Empty else DeviceCalendarStatus.Ready,
                        )
                    }
                }.onFailure {
                    updateContent { current ->
                        if (current.selectedDate != date.toString()) return@updateContent current
                        current.copy(
                            deviceCalendarEvents = emptyList(),
                            deviceCalendarStatus = DeviceCalendarStatus.PermissionRequired,
                        )
                    }
                }
        }
    }

    private fun updateContent(transform: (CalendarUiState.Content) -> CalendarUiState.Content) {
        uiState.update { current -> if (current is CalendarUiState.Content) transform(current) else current }
    }

    fun handlePermissionResult(granted: Boolean) {
        scope.launch {
            if (!granted) {
                userPreferencesRepository.updateShowDeviceCalendars(false)
                uiState.update { current ->
                    if (current is CalendarUiState.Content) {
                        current.copy(
                            showDeviceCalendars = false,
                            deviceCalendarEvents = emptyList(),
                            deviceCalendarStatus = DeviceCalendarStatus.PermissionRequired,
                        )
                    } else {
                        current
                    }
                }
                return@launch
            }
            val selectedDate = (uiState.value as? CalendarUiState.Content)?.selectedDate ?: return@launch
            load(LocalDate.parse(selectedDate))
        }
    }
}
