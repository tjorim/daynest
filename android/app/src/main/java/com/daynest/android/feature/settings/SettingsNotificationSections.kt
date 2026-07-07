package com.daynest.android.feature.settings

import android.app.TimePickerDialog
import android.content.Context
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.unit.dp
import com.daynest.android.R
import java.time.ZoneId

internal fun LazyListScope.settingsNotificationsSection(
    state: SettingsUiState.Content,
    onEvent: (SettingsUiEvent) -> Unit
) {
    item {
        HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
        Text(
            text = stringResource(id = R.string.settings_notifications_section),
            style = MaterialTheme.typography.titleMedium
        )
    }
    if (state.userSettingsLoadError) {
        item {
            loadErrorText(
                messageRes = R.string.settings_notifications_error,
                onRetry = { onEvent(SettingsUiEvent.RetryClicked) }
            )
        }
    }
    item { timezoneCard(state, onEvent) }
    item {
        SettingToggleCard(
            title = stringResource(id = R.string.settings_push_overdue_label),
            subtitle = stringResource(id = R.string.settings_push_overdue_hint),
            checked = state.pushOverdueChoresEnabled,
            onCheckedChange = { onEvent(SettingsUiEvent.UpdatePushOverdueChoresEnabled(it)) }
        )
    }
    item {
        SettingToggleCard(
            title = stringResource(id = R.string.settings_push_med_reminders_label),
            subtitle = stringResource(id = R.string.settings_push_med_reminders_hint),
            checked = state.pushMedicationRemindersEnabled,
            onCheckedChange = { onEvent(SettingsUiEvent.UpdatePushMedicationRemindersEnabled(it)) }
        )
    }
    item {
        SettingToggleCard(
            title = stringResource(id = R.string.settings_push_missed_med_label),
            subtitle = stringResource(id = R.string.settings_push_missed_med_hint),
            checked = state.pushMissedMedicationsEnabled,
            onCheckedChange = { onEvent(SettingsUiEvent.UpdatePushMissedMedicationsEnabled(it)) }
        )
    }
    item { medicationReminderMinutesCard(state, onEvent) }
    item { quietHoursCard(state, onEvent) }
    item { calendarFeedCard(state, onEvent) }
}

@Composable
private fun timezoneCard(state: SettingsUiState.Content, onEvent: (SettingsUiEvent) -> Unit) {
    var input by remember(state.timezone) { mutableStateOf(state.timezone) }
    val isValid = remember(input) { runCatching { ZoneId.of(input) }.isSuccess }

    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = stringResource(id = R.string.settings_timezone_label),
                style = MaterialTheme.typography.bodyMedium
            )
            OutlinedTextField(
                value = input,
                onValueChange = { input = it },
                isError = !isValid,
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            TextButton(
                onClick = { onEvent(SettingsUiEvent.UpdateTimezone(input)) },
                enabled = isValid && input != state.timezone && !state.userSettingsSaving,
                modifier = Modifier.align(Alignment.End)
            ) {
                Text(text = stringResource(id = R.string.settings_timezone_save))
            }
        }
    }
}

@Composable
private fun medicationReminderMinutesCard(state: SettingsUiState.Content, onEvent: (SettingsUiEvent) -> Unit) {
    var input by remember(state.medicationReminderMinutes) {
        mutableStateOf(state.medicationReminderMinutes.toString())
    }
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = stringResource(id = R.string.settings_medication_reminder_minutes_label),
                style = MaterialTheme.typography.bodyMedium
            )
            OutlinedTextField(
                value = input,
                onValueChange = { raw ->
                    val filtered = raw.filter { it.isDigit() }
                    input = filtered
                    filtered.toIntOrNull()?.let { minutes ->
                        onEvent(SettingsUiEvent.UpdateMedicationReminderMinutes(minutes))
                    }
                },
                singleLine = true
            )
        }
    }
}

@Composable
private fun quietHoursCard(state: SettingsUiState.Content, onEvent: (SettingsUiEvent) -> Unit) {
    val context = LocalContext.current
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = stringResource(id = R.string.settings_quiet_hours_label),
                style = MaterialTheme.typography.bodyMedium
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                quietHourField(
                    modifier = Modifier.weight(1f),
                    label = stringResource(id = R.string.settings_quiet_hours_start_label),
                    value = state.quietHoursStart,
                    context = context,
                    onSelected = { onEvent(SettingsUiEvent.UpdateQuietHours(start = it, end = state.quietHoursEnd)) }
                )
                quietHourField(
                    modifier = Modifier.weight(1f),
                    label = stringResource(id = R.string.settings_quiet_hours_end_label),
                    value = state.quietHoursEnd,
                    context = context,
                    onSelected = { onEvent(SettingsUiEvent.UpdateQuietHours(start = state.quietHoursStart, end = it)) }
                )
            }
            if (state.quietHoursStart != null || state.quietHoursEnd != null) {
                TextButton(
                    onClick = { onEvent(SettingsUiEvent.UpdateQuietHours(start = null, end = null)) },
                    modifier = Modifier.align(Alignment.End)
                ) {
                    Text(text = stringResource(id = R.string.settings_quiet_hours_clear))
                }
            }
        }
    }
}

@Composable
private fun quietHourField(
    modifier: Modifier,
    label: String,
    value: String?,
    context: Context,
    onSelected: (String) -> Unit
) {
    val displayValue = value?.take(5) ?: ""
    OutlinedTextField(
        value = displayValue,
        onValueChange = {},
        readOnly = true,
        label = { Text(text = label) },
        modifier =
        modifier.clickableTimePicker(
            context = context,
            initialValue = value,
            onSelected = onSelected
        )
    )
}

private fun Modifier.clickableTimePicker(
    context: Context,
    initialValue: String?,
    onSelected: (String) -> Unit
): Modifier {
    val (initialHour, initialMinute) =
        initialValue?.split(":")?.let { parts ->
            parts.getOrNull(0)?.toIntOrNull()?.let { hour ->
                parts.getOrNull(1)?.toIntOrNull()?.let { minute -> hour to minute }
            }
        } ?: (0 to 0)
    return this.then(
        Modifier
            .focusProperties { canFocus = false }
            .clickable {
                TimePickerDialog(
                    context,
                    { _, hour, minute -> onSelected("%02d:%02d:00".format(hour, minute)) },
                    initialHour,
                    initialMinute,
                    true
                ).show()
            }
    )
}

@Composable
private fun calendarFeedCard(state: SettingsUiState.Content, onEvent: (SettingsUiEvent) -> Unit) {
    val clipboardManager = LocalClipboardManager.current
    var showConfirmRegenerate by remember { mutableStateOf(false) }

    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = stringResource(id = R.string.settings_calendar_feed_label),
                style = MaterialTheme.typography.bodyMedium
            )
            if (state.calendarFeedUrl != null) {
                Text(
                    text = state.calendarFeedUrl,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.outline
                )
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TextButton(
                    onClick = {
                        state.calendarFeedUrl?.let { clipboardManager.setText(AnnotatedString(it)) }
                    },
                    enabled = state.calendarFeedUrl != null
                ) {
                    Text(text = stringResource(id = R.string.settings_calendar_feed_copy))
                }
                TextButton(
                    onClick = { showConfirmRegenerate = true },
                    enabled = !state.calendarFeedRegenerating
                ) {
                    Text(text = stringResource(id = R.string.settings_calendar_feed_regenerate))
                }
            }
        }
    }

    if (showConfirmRegenerate) {
        regenerateCalendarFeedDialog(
            onConfirm = {
                showConfirmRegenerate = false
                onEvent(SettingsUiEvent.RegenerateCalendarFeedClicked)
            },
            onDismiss = { showConfirmRegenerate = false }
        )
    }
}

@Composable
private fun regenerateCalendarFeedDialog(onConfirm: () -> Unit, onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(text = stringResource(id = R.string.settings_calendar_feed_regenerate)) },
        text = { Text(text = stringResource(id = R.string.settings_calendar_feed_regenerate_confirm)) },
        confirmButton = {
            TextButton(onClick = onConfirm) {
                Text(text = stringResource(id = R.string.settings_calendar_feed_regenerate))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(text = stringResource(id = R.string.action_cancel))
            }
        }
    )
}
