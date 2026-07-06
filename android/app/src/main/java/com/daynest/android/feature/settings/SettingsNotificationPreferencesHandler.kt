package com.daynest.android.feature.settings

import com.daynest.android.data.settings.SettingsRepository
import com.daynest.android.data.settings.UserSettingsDto
import com.daynest.android.data.settings.UserSettingsPatchDto
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

internal class SettingsNotificationPreferencesHandler(
    private val scope: CoroutineScope,
    private val settingsRepository: SettingsRepository,
    private val uiState: MutableStateFlow<SettingsUiState>
) {
    fun onEvent(event: SettingsUiEvent) {
        when (event) {
            is SettingsUiEvent.UpdateTimezone -> updateUserSettings { copy(timezone = event.timezone) }
            is SettingsUiEvent.UpdatePushOverdueChoresEnabled ->
                updateUserSettings { copy(pushOverdueChoresEnabled = event.enabled) }
            is SettingsUiEvent.UpdatePushMedicationRemindersEnabled ->
                updateUserSettings { copy(pushMedicationRemindersEnabled = event.enabled) }
            is SettingsUiEvent.UpdatePushMissedMedicationsEnabled ->
                updateUserSettings { copy(pushMissedMedicationsEnabled = event.enabled) }
            is SettingsUiEvent.UpdateMedicationReminderMinutes ->
                updateUserSettings { copy(medicationReminderMinutes = event.minutes) }
            is SettingsUiEvent.UpdateQuietHours ->
                updateUserSettings(isQuietHoursUpdate = true) {
                    copy(quietHoursStart = event.start, quietHoursEnd = event.end)
                }
            SettingsUiEvent.RegenerateCalendarFeedClicked -> regenerateCalendarFeed()
            else -> Unit
        }
    }

    private fun updateUserSettings(
        isQuietHoursUpdate: Boolean = false,
        patch: UserSettingsPatchDto.() -> UserSettingsPatchDto
    ) {
        val previous = (uiState.value as? SettingsUiState.Content) ?: return
        val request = UserSettingsPatchDto().patch()
        applyOptimistic(request, isQuietHoursUpdate)
        scope.launch {
            uiState.update { current ->
                if (current is SettingsUiState.Content) current.copy(userSettingsSaving = true) else current
            }
            val result = settingsRepository.updateUserSettings(request)
            result.onSuccess { updated ->
                uiState.update { current ->
                    if (current is SettingsUiState.Content) {
                        current.applyUserSettings(updated).copy(userSettingsSaving = false)
                    } else {
                        current
                    }
                }
            }.onFailure {
                uiState.update { current ->
                    if (current is SettingsUiState.Content) {
                        current.copy(
                            timezone = previous.timezone,
                            pushOverdueChoresEnabled = previous.pushOverdueChoresEnabled,
                            pushMedicationRemindersEnabled = previous.pushMedicationRemindersEnabled,
                            pushMissedMedicationsEnabled = previous.pushMissedMedicationsEnabled,
                            medicationReminderMinutes = previous.medicationReminderMinutes,
                            quietHoursStart = previous.quietHoursStart,
                            quietHoursEnd = previous.quietHoursEnd,
                            userSettingsSaving = false
                        )
                    } else {
                        current
                    }
                }
            }
        }
    }

    private fun applyOptimistic(request: UserSettingsPatchDto, isQuietHoursUpdate: Boolean) {
        uiState.update { current ->
            if (current !is SettingsUiState.Content) return@update current
            current.copy(
                timezone = request.timezone ?: current.timezone,
                pushOverdueChoresEnabled = request.pushOverdueChoresEnabled ?: current.pushOverdueChoresEnabled,
                pushMedicationRemindersEnabled =
                request.pushMedicationRemindersEnabled ?: current.pushMedicationRemindersEnabled,
                pushMissedMedicationsEnabled =
                request.pushMissedMedicationsEnabled ?: current.pushMissedMedicationsEnabled,
                medicationReminderMinutes = request.medicationReminderMinutes ?: current.medicationReminderMinutes,
                quietHoursStart = if (isQuietHoursUpdate) request.quietHoursStart else current.quietHoursStart,
                quietHoursEnd = if (isQuietHoursUpdate) request.quietHoursEnd else current.quietHoursEnd
            )
        }
    }

    private fun regenerateCalendarFeed() {
        scope.launch {
            uiState.update { current ->
                if (current is SettingsUiState.Content) current.copy(calendarFeedRegenerating = true) else current
            }
            val result = settingsRepository.regenerateCalendarFeed()
            uiState.update { current ->
                if (current !is SettingsUiState.Content) return@update current
                result.fold(
                    onSuccess = { feed ->
                        current.copy(calendarFeedUrl = feed.feedUrl, calendarFeedRegenerating = false)
                    },
                    onFailure = { current.copy(calendarFeedRegenerating = false) }
                )
            }
        }
    }

    private fun SettingsUiState.Content.applyUserSettings(dto: UserSettingsDto): SettingsUiState.Content =
        copy(
            timezone = dto.timezone,
            pushOverdueChoresEnabled = dto.pushOverdueChoresEnabled,
            pushMedicationRemindersEnabled = dto.pushMedicationRemindersEnabled,
            pushMissedMedicationsEnabled = dto.pushMissedMedicationsEnabled,
            medicationReminderMinutes = dto.medicationReminderMinutes,
            quietHoursStart = dto.quietHoursStart,
            quietHoursEnd = dto.quietHoursEnd
        )
}
