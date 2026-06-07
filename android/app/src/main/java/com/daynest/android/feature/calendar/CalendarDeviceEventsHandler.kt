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
                uiState.update { current ->
                    if (current is CalendarUiState.Content) {
                        current.copy(
                            deviceCalendarEvents = emptyList(),
                            deviceCalendarStatus = DeviceCalendarStatus.Idle,
                        )
                    } else {
                        current
                    }
                }
                return@launch
            }
            if (preferences().enabledDeviceCalendarIds.isEmpty()) {
                uiState.update { current ->
                    if (current is CalendarUiState.Content) {
                        current.copy(
                            deviceCalendarEvents = emptyList(),
                            deviceCalendarStatus = DeviceCalendarStatus.NoEnabledCalendars,
                        )
                    } else {
                        current
                    }
                }
                return@launch
            }
            uiState.update { current ->
                if (current is CalendarUiState.Content) {
                    current.copy(deviceCalendarStatus = DeviceCalendarStatus.Loading)
                } else {
                    current
                }
            }
            deviceCalendarRepository
                .listEventsForDay(date, preferences().enabledDeviceCalendarIds)
                .onSuccess { events ->
                    uiState.update { current ->
                        if (current is CalendarUiState.Content && current.selectedDate == date.toString()) {
                            current.copy(
                                deviceCalendarEvents = events,
                                deviceCalendarStatus =
                                    if (events.isEmpty()) DeviceCalendarStatus.Empty else DeviceCalendarStatus.Ready,
                            )
                        } else {
                            current
                        }
                    }
                }.onFailure {
                    uiState.update { current ->
                        if (current is CalendarUiState.Content && current.selectedDate == date.toString()) {
                            current.copy(
                                deviceCalendarEvents = emptyList(),
                                deviceCalendarStatus = DeviceCalendarStatus.PermissionRequired,
                            )
                        } else {
                            current
                        }
                    }
                }
        }
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
