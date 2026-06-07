package com.daynest.android.feature.settings

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.ManagedActivityResultLauncher
import androidx.activity.result.ActivityResultLauncher
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.daynest.android.R
import com.daynest.android.data.calendar.DeviceCalendar

internal fun LazyListScope.settingsServerSection(
    state: SettingsUiState.Content,
    onEvent: (SettingsUiEvent) -> Unit,
) {
    item {
        HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
        Text(
            text = stringResource(id = R.string.settings_server_section),
            style = MaterialTheme.typography.titleMedium,
        )
    }
    item {
        ApiBaseUrlOverrideCard(
            defaultServerUrl = state.defaultServerUrl,
            customServerUrl = state.customServerUrl,
            onServerUrlChanged = { onEvent(SettingsUiEvent.UpdateServerUrl(it)) },
        )
    }
}

internal fun LazyListScope.settingsPrivacySection(
    state: SettingsUiState.Content,
    context: Context,
    notificationsPermissionLauncher: ManagedActivityResultLauncher<String, Boolean>,
    calendarPermissionLauncher: ManagedActivityResultLauncher<Array<String>, Map<String, Boolean>>,
    deviceCalendarPermissionLauncher: ActivityResultLauncher<String>,
    onEvent: (SettingsUiEvent) -> Unit,
) {
    item {
        HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
        Text(
            text = stringResource(id = R.string.settings_privacy_section),
            style = MaterialTheme.typography.titleMedium,
        )
    }
    item {
        SettingToggleCard(
            title = stringResource(id = R.string.settings_notifications_label),
            subtitle = stringResource(id = R.string.settings_notifications_hint),
            checked = state.pushNotificationsEnabled,
            onCheckedChange = { enabled ->
                handleNotificationsChanged(
                    enabled = enabled,
                    context = context,
                    notificationsPermissionLauncher = notificationsPermissionLauncher,
                    onEvent = onEvent,
                )
            },
        )
    }
    item {
        SettingToggleCard(
            title = stringResource(id = R.string.settings_biometric_label),
            subtitle = stringResource(id = R.string.settings_biometric_hint),
            checked = state.biometricLockEnabled,
            onCheckedChange = { onEvent(SettingsUiEvent.UpdateBiometricLockEnabled(it)) },
        )
    }
    item {
        biometricTimeoutCard(state, onEvent)
    }
    item {
        SettingToggleCard(
            title = stringResource(id = R.string.settings_calendar_sync_label),
            subtitle = stringResource(id = R.string.settings_calendar_sync_hint),
            checked = state.calendarSyncEnabled,
            onCheckedChange = { enabled ->
                handleCalendarSyncChanged(
                    enabled = enabled,
                    context = context,
                    calendarPermissionLauncher = calendarPermissionLauncher,
                    onEvent = onEvent,
                )
            },
        )
    }
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
                    onEvent = onEvent,
                )
            },
        )
    }
    if (state.showDeviceCalendars) {
        if (state.deviceCalendars.isEmpty()) {
            item { emptyStateText(R.string.settings_device_calendars_empty) }
        } else {
            items(state.deviceCalendars, key = { it.id }) { calendar ->
                DeviceCalendarToggleRow(
                    calendar = calendar,
                    checked = calendar.id in state.enabledDeviceCalendarIds,
                    onCheckedChange = { onEvent(SettingsUiEvent.UpdateDeviceCalendarEnabled(calendar.id, it)) },
                )
            }
        }
    }
}

@Composable
private fun DeviceCalendarToggleRow(
    calendar: DeviceCalendar,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(text = calendar.name, style = MaterialTheme.typography.bodyMedium)
                if (!calendar.accountName.isNullOrBlank()) {
                    Text(
                        text = calendar.accountName,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.outline,
                    )
                }
            }
            Checkbox(checked = checked, onCheckedChange = onCheckedChange)
        }
    }
}

internal fun LazyListScope.settingsAccountSection(onEvent: (SettingsUiEvent) -> Unit) {
    item {
        HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
        Text(
            text = stringResource(id = R.string.settings_account_section),
            style = MaterialTheme.typography.titleMedium,
        )
    }
    item {
        Card(modifier = Modifier.fillMaxWidth()) {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = stringResource(id = R.string.settings_session_active),
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.weight(1f),
                )
                TextButton(onClick = { onEvent(SettingsUiEvent.SignOutClicked) }) {
                    Text(
                        text = stringResource(id = R.string.settings_sign_out),
                        color = MaterialTheme.colorScheme.error,
                    )
                }
            }
        }
    }
}

internal fun LazyListScope.settingsClientsSection(
    state: SettingsUiState.Content,
    onEvent: (SettingsUiEvent) -> Unit,
) {
    item {
        HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = stringResource(id = R.string.settings_integrations_section),
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.weight(1f),
            )
            TextButton(onClick = { onEvent(SettingsUiEvent.ShowCreateClientForm) }) {
                Text(text = stringResource(id = R.string.settings_new_client))
            }
        }
    }
    when {
        state.clientsLoadError ->
            item {
                loadErrorText(
                    messageRes = R.string.settings_clients_error,
                    onRetry = { onEvent(SettingsUiEvent.RetryClicked) },
                )
            }
        state.clients.isEmpty() ->
            item {
                emptyStateText(messageRes = R.string.settings_no_clients)
            }
        else ->
            items(state.clients, key = { "client_${it.id}" }) { client ->
                IntegrationClientCard(client = client)
            }
    }
}

internal fun LazyListScope.settingsSessionsSection(
    state: SettingsUiState.Content,
    onEvent: (SettingsUiEvent) -> Unit,
) {
    item {
        HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
        Text(
            text = stringResource(id = R.string.settings_sessions_section),
            style = MaterialTheme.typography.titleMedium,
        )
    }
    when {
        state.sessionsLoadError ->
            item {
                loadErrorText(
                    messageRes = R.string.settings_sessions_error,
                    onRetry = { onEvent(SettingsUiEvent.RetryClicked) },
                )
            }
        state.sessions.isEmpty() ->
            item {
                emptyStateText(messageRes = R.string.settings_no_sessions)
            }
        else ->
            items(state.sessions, key = { "session_${it.id}" }) { session ->
                OAuthSessionCard(
                    session = session,
                    onRevoke = { onEvent(SettingsUiEvent.RevokeSessionClicked(session.id)) },
                )
            }
    }
}

@Composable
private fun biometricTimeoutCard(
    state: SettingsUiState.Content,
    onEvent: (SettingsUiEvent) -> Unit,
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                text = stringResource(id = R.string.settings_biometric_timeout_label),
                style = MaterialTheme.typography.bodyMedium,
            )
            OutlinedTextField(
                value = state.biometricIdleTimeoutMinutes.toString(),
                onValueChange = { raw ->
                    raw.toIntOrNull()?.let { minutes ->
                        onEvent(SettingsUiEvent.UpdateBiometricIdleTimeoutMinutes(minutes))
                    }
                },
                singleLine = true,
            )
        }
    }
}

@Composable
private fun loadErrorText(
    messageRes: Int,
    onRetry: () -> Unit,
) {
    Text(
        text = stringResource(id = messageRes),
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.error,
    )
    TextButton(onClick = onRetry) {
        Text(text = stringResource(id = R.string.home_retry))
    }
}

@Composable
private fun emptyStateText(messageRes: Int) {
    Text(
        text = stringResource(id = messageRes),
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.outline,
    )
}

private fun handleNotificationsChanged(
    enabled: Boolean,
    context: Context,
    notificationsPermissionLauncher: ManagedActivityResultLauncher<String, Boolean>,
    onEvent: (SettingsUiEvent) -> Unit,
) {
    if (!enabled) {
        onEvent(SettingsUiEvent.UpdatePushNotificationsEnabled(false))
    } else if (
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
        ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.POST_NOTIFICATIONS,
        ) != PackageManager.PERMISSION_GRANTED
    ) {
        notificationsPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
    } else {
        onEvent(SettingsUiEvent.UpdatePushNotificationsEnabled(true))
    }
}

private fun handleDeviceCalendarsChanged(
    enabled: Boolean,
    context: Context,
    permissionLauncher: ActivityResultLauncher<String>,
    onEvent: (SettingsUiEvent) -> Unit,
) {
    if (!enabled) {
        onEvent(SettingsUiEvent.UpdateShowDeviceCalendars(false))
        return
    }
    if (
        ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.READ_CALENDAR,
        ) == PackageManager.PERMISSION_GRANTED
    ) {
        onEvent(SettingsUiEvent.UpdateShowDeviceCalendars(true))
    } else {
        permissionLauncher.launch(Manifest.permission.READ_CALENDAR)
    }
}

private fun handleCalendarSyncChanged(
    enabled: Boolean,
    context: Context,
    calendarPermissionLauncher: ManagedActivityResultLauncher<Array<String>, Map<String, Boolean>>,
    onEvent: (SettingsUiEvent) -> Unit,
) {
    if (!enabled) {
        onEvent(SettingsUiEvent.UpdateCalendarSyncEnabled(false))
        return
    }

    val hasRead =
        ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.READ_CALENDAR,
        ) == PackageManager.PERMISSION_GRANTED
    val hasWrite =
        ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.WRITE_CALENDAR,
        ) == PackageManager.PERMISSION_GRANTED
    if (hasRead && hasWrite) {
        onEvent(SettingsUiEvent.UpdateCalendarSyncEnabled(true))
    } else {
        calendarPermissionLauncher.launch(
            arrayOf(
                Manifest.permission.READ_CALENDAR,
                Manifest.permission.WRITE_CALENDAR,
            ),
        )
    }
}
