package com.daynest.android.feature.settings

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import androidx.activity.result.ActivityResultLauncher
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.daynest.android.R
import com.daynest.android.data.calendar.DeviceCalendar

@Composable
internal fun deviceCalendarToggleRow(calendar: DeviceCalendar, checked: Boolean, onCheckedChange: (Boolean) -> Unit) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier =
            Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(text = calendar.name, style = MaterialTheme.typography.bodyMedium)
                if (!calendar.accountName.isNullOrBlank()) {
                    Text(
                        text = calendar.accountName,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.outline
                    )
                }
            }
            Checkbox(checked = checked, onCheckedChange = onCheckedChange)
        }
    }
}

internal fun LazyListScope.settingsDeviceCalendarsToggleAndList(
    state: SettingsUiState.Content,
    context: Context,
    deviceCalendarPermissionLauncher: ActivityResultLauncher<String>,
    onEvent: (SettingsUiEvent) -> Unit
) {
    item {
        SettingToggleCard(
            title = stringResource(id = R.string.settings_device_calendars_label),
            subtitle = stringResource(id = R.string.settings_device_calendars_hint),
            checked = state.showDeviceCalendars,
            onCheckedChange = { enabled ->
                handleDeviceCalendarsChanged(
                    enabled = enabled,
                    context = context,
                    permissionLauncher = deviceCalendarPermissionLauncher,
                    onEvent = onEvent
                )
            }
        )
    }
    settingsDeviceCalendarsSubList(state, onEvent)
}

internal fun LazyListScope.settingsDeviceCalendarsSubList(
    state: SettingsUiState.Content,
    onEvent: (SettingsUiEvent) -> Unit
) {
    if (!state.showDeviceCalendars) return
    if (state.deviceCalendars.isEmpty()) {
        item { emptyStateText(R.string.settings_device_calendars_empty) }
    } else {
        items(state.deviceCalendars, key = { it.id }) { calendar ->
            deviceCalendarToggleRow(
                calendar = calendar,
                checked = calendar.id in state.enabledDeviceCalendarIds,
                onCheckedChange = { onEvent(SettingsUiEvent.UpdateDeviceCalendarEnabled(calendar.id, it)) }
            )
        }
    }
}

internal fun handleDeviceCalendarsChanged(
    enabled: Boolean,
    context: Context,
    permissionLauncher: ActivityResultLauncher<String>,
    onEvent: (SettingsUiEvent) -> Unit
) {
    if (!enabled) {
        onEvent(SettingsUiEvent.UpdateShowDeviceCalendars(false))
        return
    }
    if (
        ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.READ_CALENDAR
        ) == PackageManager.PERMISSION_GRANTED
    ) {
        onEvent(SettingsUiEvent.UpdateShowDeviceCalendars(true))
    } else {
        permissionLauncher.launch(Manifest.permission.READ_CALENDAR)
    }
}
