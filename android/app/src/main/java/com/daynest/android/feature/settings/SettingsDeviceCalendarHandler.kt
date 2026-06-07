package com.daynest.android.feature.settings

import android.content.Context
import com.daynest.android.core.storage.preferences.UserPreferencesRepository
import com.daynest.android.data.calendar.DeviceCalendarRepository
import com.daynest.android.data.sync.DaynestSyncScheduler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

internal class SettingsDeviceCalendarHandler(
    private val scope: CoroutineScope,
    private val appContext: Context,
    private val deviceCalendarRepository: DeviceCalendarRepository,
    private val userPreferencesRepository: UserPreferencesRepository,
    private val uiState: MutableStateFlow<SettingsUiState>,
) {
    fun onPreferencesEvent(event: SettingsUiEvent) {
        when (event) {
            is SettingsUiEvent.UpdateCalendarSyncEnabled -> updateCalendarSyncEnabled(event.enabled)
            is SettingsUiEvent.UpdateShowDeviceCalendars -> updateShowDeviceCalendars(event.enabled)
            is SettingsUiEvent.UpdateDeviceCalendarEnabled -> updateDeviceCalendarEnabled(event.calendarId, event.enabled)
            else -> Unit
        }
    }

    fun updateCalendarSyncEnabled(enabled: Boolean) {
        scope.launch {
            runCatching { userPreferencesRepository.updateCalendarSyncEnabled(enabled) }.onSuccess {
                uiState.update { current ->
                    if (current is SettingsUiState.Content) current.copy(calendarSyncEnabled = enabled) else current
                }
                if (enabled) {
                    DaynestSyncScheduler.enqueueOneShot(appContext)
                }
            }
        }
    }

    fun updateShowDeviceCalendars(enabled: Boolean) {
        scope.launch {
            runCatching { userPreferencesRepository.updateShowDeviceCalendars(enabled) }.onSuccess {
                val calendars =
                    if (enabled) {
                        deviceCalendarRepository.listCalendars().getOrElse { emptyList() }
                    } else {
                        emptyList()
                    }
                uiState.update { current ->
                    if (current is SettingsUiState.Content) {
                        val enabledIds =
                            if (enabled && current.enabledDeviceCalendarIds.isEmpty()) {
                                calendars.filter { it.visible }.map { it.id }.toSet()
                            } else {
                                current.enabledDeviceCalendarIds
                            }
                        if (enabledIds != current.enabledDeviceCalendarIds) {
                            scope.launch {
                                userPreferencesRepository.updateEnabledDeviceCalendarIds(enabledIds)
                            }
                        }
                        current.copy(
                            showDeviceCalendars = enabled,
                            deviceCalendars = calendars,
                            enabledDeviceCalendarIds = enabledIds,
                        )
                    } else {
                        current
                    }
                }
            }
        }
    }

    fun updateDeviceCalendarEnabled(
        calendarId: String,
        enabled: Boolean,
    ) {
        scope.launch {
            val current = (uiState.value as? SettingsUiState.Content) ?: return@launch
            val updatedIds =
                if (enabled) {
                    current.enabledDeviceCalendarIds + calendarId
                } else {
                    current.enabledDeviceCalendarIds - calendarId
                }
            runCatching { userPreferencesRepository.updateEnabledDeviceCalendarIds(updatedIds) }.onSuccess {
                uiState.update { state ->
                    if (state is SettingsUiState.Content) {
                        state.copy(enabledDeviceCalendarIds = updatedIds)
                    } else {
                        state
                    }
                }
            }
        }
    }
}
