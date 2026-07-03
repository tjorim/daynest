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
            is SettingsUiEvent.UpdateDeviceCalendarEnabled ->
                updateDeviceCalendarEnabled(event.calendarId, event.enabled)
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
                var enabledIds: Set<String>? = null
                uiState.update { current ->
                    if (current is SettingsUiState.Content) {
                        val updatedIds =
                            if (enabled && current.enabledDeviceCalendarIds.isEmpty()) {
                                calendars.filter { it.visible }.map { it.id }.toSet()
                            } else {
                                current.enabledDeviceCalendarIds
                            }
                        enabledIds = updatedIds.takeIf { it != current.enabledDeviceCalendarIds }
                        current.copy(
                            showDeviceCalendars = enabled,
                            deviceCalendars = calendars,
                            enabledDeviceCalendarIds = updatedIds,
                        )
                    } else {
                        current
                    }
                }
                enabledIds?.let { ids ->
                    runCatching { userPreferencesRepository.updateEnabledDeviceCalendarIds(ids) }
                }
            }
        }
    }

    fun updateDeviceCalendarEnabled(
        calendarId: String,
        enabled: Boolean,
    ) {
        scope.launch {
            var updatedIds: Set<String>? = null
            uiState.update { state ->
                if (state is SettingsUiState.Content) {
                    val ids =
                        if (enabled) {
                            state.enabledDeviceCalendarIds + calendarId
                        } else {
                            state.enabledDeviceCalendarIds - calendarId
                        }
                    updatedIds = ids
                    state.copy(enabledDeviceCalendarIds = ids)
                } else {
                    state
                }
            }
            updatedIds?.let { ids ->
                runCatching { userPreferencesRepository.updateEnabledDeviceCalendarIds(ids) }
            }
        }
    }
}
