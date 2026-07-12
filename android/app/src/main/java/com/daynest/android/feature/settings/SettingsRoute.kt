@file:Suppress("ktlint:standard:function-naming", "FunctionNaming")

package com.daynest.android.feature.settings

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.daynest.android.R
import com.daynest.android.app.navigation.DaynestDestination
import com.daynest.android.app.navigation.DaynestNavigationScaffold
import com.daynest.android.data.settings.IntegrationClientDto
import com.daynest.android.data.settings.IntegrationClientInputDto
import com.daynest.android.data.settings.OAuthSessionDto
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

@Composable
fun SettingsRoute(
    onNavigate: (String) -> Unit = {},
    onOpenPrivacyPolicy: () -> Unit = {},
    onSignedOut: (() -> Unit)? = null,
    viewModel: SettingsViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    val signOutLauncher =
        rememberLauncherForActivityResult(
            contract = ActivityResultContracts.StartActivityForResult()
        ) { }

    LaunchedEffect(Unit) {
        viewModel.signOutIntent.collect { intent ->
            signOutLauncher.launch(intent)
        }
    }

    LaunchedEffect(uiState) {
        if (uiState is SettingsUiState.SignedOut) {
            onSignedOut?.invoke()
        }
    }

    SettingsScreen(
        uiState = uiState,
        onEvent = viewModel::onEvent,
        onNavigate = onNavigate,
        onOpenPrivacyPolicy = onOpenPrivacyPolicy
    )
}

@Composable
private fun SettingsScreen(
    uiState: SettingsUiState,
    onEvent: (SettingsUiEvent) -> Unit,
    onNavigate: (String) -> Unit,
    onOpenPrivacyPolicy: () -> Unit
) {
    DaynestNavigationScaffold(
        currentRoute = DaynestDestination.SETTINGS,
        onNavigate = onNavigate
    ) { innerPadding ->
        when (uiState) {
            SettingsUiState.Loading, SettingsUiState.SignedOut -> {
                Box(
                    modifier =
                    Modifier
                        .fillMaxSize()
                        .padding(innerPadding),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }

            is SettingsUiState.Content -> {
                SettingsContent(
                    state = uiState,
                    onEvent = onEvent,
                    onOpenPrivacyPolicy = onOpenPrivacyPolicy,
                    modifier = Modifier.padding(innerPadding)
                )
            }
        }
    }
}

@Composable
private fun SettingsContent(
    state: SettingsUiState.Content,
    onEvent: (SettingsUiEvent) -> Unit,
    onOpenPrivacyPolicy: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val deviceCalendarPermissionLauncher =
        rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            onEvent(SettingsUiEvent.UpdateShowDeviceCalendars(granted))
        }
    val calendarPermissionLauncher =
        rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { result ->
            val granted =
                result.isNotEmpty() &&
                    result[Manifest.permission.READ_CALENDAR] == true &&
                    result[Manifest.permission.WRITE_CALENDAR] == true
            onEvent(SettingsUiEvent.UpdateCalendarSyncEnabled(granted))
        }
    val notificationsPermissionLauncher =
        rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            onEvent(SettingsUiEvent.UpdatePushNotificationsEnabled(granted))
        }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        item {
            Text(
                text = stringResource(id = R.string.settings_title),
                style = MaterialTheme.typography.headlineMedium
            )
        }
        settingsServerSection(state, onEvent)
        settingsPrivacySection(
            state = state,
            context = context,
            notificationsPermissionLauncher = notificationsPermissionLauncher,
            calendarPermissionLauncher = calendarPermissionLauncher,
            deviceCalendarPermissionLauncher = deviceCalendarPermissionLauncher,
            onEvent = onEvent
        )
        settingsNotificationsSection(state, onEvent)
        settingsAccountSection(state, onEvent, onOpenPrivacyPolicy)
        settingsClientsSection(state, onEvent)
        settingsSessionsSection(state, onEvent)
    }

    SettingsDialogs(state = state, onEvent = onEvent)
}

@Composable
private fun SettingsDialogs(state: SettingsUiState.Content, onEvent: (SettingsUiEvent) -> Unit) {
    if (state.showCreateForm) {
        CreateClientDialog(
            onConfirm = { onEvent(SettingsUiEvent.CreateClient(it)) },
            onDismiss = { onEvent(SettingsUiEvent.DismissCreateClientForm) }
        )
    }
    if (state.newApiKey != null) {
        NewApiKeyDialog(
            apiKey = state.newApiKey,
            onDismiss = { onEvent(SettingsUiEvent.DismissNewKeyDialog) }
        )
    }
    if (state.showDeleteAccountConfirm) {
        DeleteAccountDialog(
            isDeleting = state.isDeletingAccount,
            onConfirm = { onEvent(SettingsUiEvent.DeleteAccountConfirmed) },
            onDismiss = { onEvent(SettingsUiEvent.DismissDeleteAccountDialog) }
        )
    }
}

@Composable
internal fun SettingToggleCard(title: String, subtitle: String, checked: Boolean, onCheckedChange: (Boolean) -> Unit) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier =
            Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(text = title, style = MaterialTheme.typography.bodyMedium)
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.outline
                )
            }
            Switch(checked = checked, onCheckedChange = onCheckedChange)
        }
    }
}

@Composable
internal fun OAuthSessionCard(session: OAuthSessionDto, onRevoke: () -> Unit) {
    val formatter = remember { DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm").withZone(ZoneId.systemDefault()) }
    val lastActiveText =
        remember(session.lastAccess) {
            session.lastAccess?.let { formatter.format(Instant.ofEpochMilli(it)) }
        }

    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier =
            Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                val clientNames =
                    session.clients
                        .joinToString(", ") { it.clientName ?: it.clientId }
                        .ifBlank { session.id.take(8) }
                Text(text = clientNames, style = MaterialTheme.typography.bodyMedium)
                if (!session.ipAddress.isNullOrBlank()) {
                    Text(
                        text = session.ipAddress,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.outline
                    )
                }
                if (lastActiveText != null) {
                    Text(
                        text = stringResource(id = R.string.settings_session_last_active, lastActiveText),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.outline
                    )
                }
            }
            TextButton(
                onClick = onRevoke,
                colors =
                androidx.compose.material3.ButtonDefaults.textButtonColors(
                    contentColor = MaterialTheme.colorScheme.error
                )
            ) {
                Text(text = stringResource(id = R.string.settings_revoke_session))
            }
        }
    }
}

@Composable
internal fun IntegrationClientCard(client: IntegrationClientDto) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = client.name,
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.weight(1f)
                )
                Text(
                    text =
                    if (client.isActive) {
                        stringResource(id = R.string.settings_client_active)
                    } else {
                        stringResource(id = R.string.settings_client_inactive)
                    },
                    style = MaterialTheme.typography.labelSmall,
                    color =
                    if (client.isActive) {
                        MaterialTheme.colorScheme.primary
                    } else {
                        MaterialTheme.colorScheme.outline
                    }
                )
            }
            Text(
                text =
                stringResource(
                    id = R.string.settings_client_rate_limit,
                    client.rateLimitPerMinute
                ),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.outline
            )
        }
    }
}

@Composable
private fun CreateClientDialog(onConfirm: (IntegrationClientInputDto) -> Unit, onDismiss: () -> Unit) {
    var name by remember { mutableStateOf("") }
    var rateLimit by remember { mutableStateOf("60") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(text = stringResource(id = R.string.settings_create_client_title)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text(text = stringResource(id = R.string.settings_client_name_label)) },
                    singleLine = true
                )
                OutlinedTextField(
                    value = rateLimit,
                    onValueChange = { rateLimit = it.filter { c -> c.isDigit() } },
                    label = { Text(text = stringResource(id = R.string.settings_client_rate_limit_label)) },
                    singleLine = true
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    if (name.isNotBlank()) {
                        onConfirm(
                            IntegrationClientInputDto(
                                name = name.trim(),
                                rateLimitPerMinute = rateLimit.toIntOrNull() ?: 60
                            )
                        )
                    }
                },
                enabled = name.isNotBlank()
            ) {
                Text(text = stringResource(id = R.string.action_add))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(text = stringResource(id = R.string.action_cancel))
            }
        }
    )
}

@Composable
private fun NewApiKeyDialog(apiKey: String, onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(text = stringResource(id = R.string.settings_new_key_title)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = stringResource(id = R.string.settings_new_key_notice),
                    style = MaterialTheme.typography.bodyMedium
                )
                Text(
                    text = apiKey,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.primary
                )
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text(text = stringResource(id = R.string.settings_new_key_dismiss))
            }
        }
    )
}

@Composable
private fun DeleteAccountDialog(isDeleting: Boolean, onConfirm: () -> Unit, onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = {
            if (!isDeleting) onDismiss()
        },
        title = { Text(text = stringResource(id = R.string.settings_delete_account_title)) },
        text = { Text(text = stringResource(id = R.string.settings_delete_account_confirm)) },
        confirmButton = {
            TextButton(onClick = onConfirm, enabled = !isDeleting) {
                Text(text = stringResource(id = R.string.settings_delete_account_confirm_action))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss, enabled = !isDeleting) {
                Text(text = stringResource(id = R.string.action_cancel))
            }
        }
    )
}
