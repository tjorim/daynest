@file:Suppress("ktlint:standard:function-naming", "FunctionNaming")

package com.daynest.android.feature.settings

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
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
import com.daynest.android.ui.ServerUrlPicker
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private data class IntegrationPreset(
    val labelResId: Int,
    val descriptionResId: Int,
    val input: IntegrationClientInputDto,
)

private val INTEGRATION_PRESETS =
    listOf(
        IntegrationPreset(
            labelResId = R.string.settings_preset_ha_dashboard,
            descriptionResId = R.string.settings_preset_ha_dashboard_desc,
            input = IntegrationClientInputDto(name = "Home Assistant", scopes = listOf("ha:read"), rateLimitPerMinute = 120),
        ),
        IntegrationPreset(
            labelResId = R.string.settings_preset_ha_automations,
            descriptionResId = R.string.settings_preset_ha_automations_desc,
            input = IntegrationClientInputDto(name = "Home Assistant Automations", scopes = listOf("ha:read", "ha:write"), rateLimitPerMinute = 120),
        ),
        IntegrationPreset(
            labelResId = R.string.settings_preset_mcp_readonly,
            descriptionResId = R.string.settings_preset_mcp_readonly_desc,
            input = IntegrationClientInputDto(name = "MCP Adapter", scopes = listOf("mcp:read"), rateLimitPerMinute = 60),
        ),
    )

@Composable
fun SettingsRoute(
    onNavigate: (String) -> Unit = {},
    onSignedOut: (() -> Unit)? = null,
    viewModel: SettingsViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(uiState) {
        if (uiState is SettingsUiState.SignedOut) {
            onSignedOut?.invoke()
        }
    }

    SettingsScreen(uiState = uiState, onEvent = viewModel::onEvent, onNavigate = onNavigate)
}

@Composable
private fun SettingsScreen(
    uiState: SettingsUiState,
    onEvent: (SettingsUiEvent) -> Unit,
    onNavigate: (String) -> Unit,
) {
    DaynestNavigationScaffold(
        currentRoute = DaynestDestination.SETTINGS,
        onNavigate = onNavigate,
    ) { innerPadding ->
        when (uiState) {
            SettingsUiState.Loading, SettingsUiState.SignedOut -> {
                Box(
                    modifier =
                        Modifier
                            .fillMaxSize()
                            .padding(innerPadding),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator()
                }
            }

            is SettingsUiState.Content -> {
                SettingsContent(
                    state = uiState,
                    onEvent = onEvent,
                    modifier = Modifier.padding(innerPadding),
                )
            }
        }
    }
}

@Composable
@Suppress("LongMethod")
private fun SettingsContent(
    state: SettingsUiState.Content,
    onEvent: (SettingsUiEvent) -> Unit,
    modifier: Modifier = Modifier,
) {
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        item {
            Text(
                text = stringResource(id = R.string.settings_title),
                style = MaterialTheme.typography.headlineMedium,
            )
        }

        item {
            HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
            Text(
                text = stringResource(id = R.string.settings_server_section),
                style = MaterialTheme.typography.titleMedium,
            )
        }

        item {
            ServerUrlPicker(
                defaultServerUrl = state.defaultServerUrl,
                customServerUrl = state.customServerUrl,
                onServerUrlChanged = { onEvent(SettingsUiEvent.UpdateServerUrl(it)) },
            )
        }

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

        item {
            HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
            Text(
                text = stringResource(id = R.string.settings_presets_section),
                style = MaterialTheme.typography.titleMedium,
            )
        }

        items(INTEGRATION_PRESETS, key = { it.labelResId }) { preset ->
            Card(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clickable { onEvent(SettingsUiEvent.ShowCreateClientFormWithPreset(preset.input)) },
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text(
                        text = stringResource(id = preset.labelResId),
                        style = MaterialTheme.typography.bodyMedium,
                    )
                    Text(
                        text = stringResource(id = preset.descriptionResId),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.outline,
                    )
                }
            }
        }

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

        if (state.loadError) {
            item {
                Text(
                    text = stringResource(id = R.string.settings_clients_error),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                )
                TextButton(onClick = { onEvent(SettingsUiEvent.RetryClicked) }) {
                    Text(text = stringResource(id = R.string.home_retry))
                }
            }
        } else if (state.clients.isEmpty()) {
            item {
                Text(
                    text = stringResource(id = R.string.settings_no_clients),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.outline,
                )
            }
        } else {
            items(state.clients, key = { "client_${it.id}" }) { client ->
                IntegrationClientCard(client = client)
            }
        }

        item {
            HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
            Text(
                text = stringResource(id = R.string.settings_sessions_section),
                style = MaterialTheme.typography.titleMedium,
            )
        }

        if (state.sessions.isEmpty()) {
            item {
                Text(
                    text = stringResource(id = R.string.settings_no_sessions),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.outline,
                )
            }
        } else {
            items(state.sessions, key = { "session_${it.id}" }) { session ->
                OAuthSessionCard(
                    session = session,
                    onRevoke = { onEvent(SettingsUiEvent.RevokeSessionClicked(session.id)) },
                )
            }
        }
    }

    if (state.showCreateForm) {
        CreateClientDialog(
            initialValues = state.createFormPreset,
            onConfirm = { onEvent(SettingsUiEvent.CreateClient(it)) },
            onDismiss = { onEvent(SettingsUiEvent.DismissCreateClientForm) },
        )
    }

    if (state.newApiKey != null) {
        NewApiKeyDialog(
            apiKey = state.newApiKey,
            onDismiss = { onEvent(SettingsUiEvent.DismissNewKeyDialog) },
        )
    }
}

@Composable
private fun OAuthSessionCard(
    session: OAuthSessionDto,
    onRevoke: () -> Unit,
) {
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
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                val clientNames = session.clients.values.joinToString(", ").ifBlank { session.id.take(8) }
                Text(text = clientNames, style = MaterialTheme.typography.bodyMedium)
                if (!session.ipAddress.isNullOrBlank()) {
                    Text(
                        text = session.ipAddress,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.outline,
                    )
                }
                if (lastActiveText != null) {
                    Text(
                        text = stringResource(id = R.string.settings_session_last_active, lastActiveText),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.outline,
                    )
                }
            }
            TextButton(
                onClick = onRevoke,
                colors =
                    androidx.compose.material3.ButtonDefaults.textButtonColors(
                        contentColor = MaterialTheme.colorScheme.error,
                    ),
            ) {
                Text(text = stringResource(id = R.string.settings_revoke_session))
            }
        }
    }
}

@Composable
private fun IntegrationClientCard(client: IntegrationClientDto) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = client.name,
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.weight(1f),
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
                        },
                )
            }
            if (client.scopes.isNotEmpty()) {
                Text(
                    text = client.scopes.joinToString(", "),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.outline,
                )
            }
            Text(
                text =
                    stringResource(
                        id = R.string.settings_client_rate_limit,
                        client.rateLimitPerMinute,
                    ),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.outline,
            )
        }
    }
}

@Composable
private fun CreateClientDialog(
    initialValues: IntegrationClientInputDto? = null,
    onConfirm: (IntegrationClientInputDto) -> Unit,
    onDismiss: () -> Unit,
) {
    var name by remember(initialValues) { mutableStateOf(initialValues?.name ?: "") }
    var scopes by remember(initialValues) { mutableStateOf(initialValues?.scopes?.joinToString(", ") ?: "") }
    var rateLimit by remember(initialValues) { mutableStateOf(initialValues?.rateLimitPerMinute?.toString() ?: "60") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(text = stringResource(id = R.string.settings_create_client_title)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text(text = stringResource(id = R.string.settings_client_name_label)) },
                    singleLine = true,
                )
                OutlinedTextField(
                    value = scopes,
                    onValueChange = { scopes = it },
                    label = { Text(text = stringResource(id = R.string.settings_client_scopes_label)) },
                    singleLine = true,
                )
                OutlinedTextField(
                    value = rateLimit,
                    onValueChange = { rateLimit = it.filter { c -> c.isDigit() } },
                    label = { Text(text = stringResource(id = R.string.settings_client_rate_limit_label)) },
                    singleLine = true,
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
                                scopes = scopes.split(",").map { it.trim() }.filter { it.isNotBlank() },
                                rateLimitPerMinute = rateLimit.toIntOrNull() ?: 60,
                            ),
                        )
                    }
                },
                enabled = name.isNotBlank(),
            ) {
                Text(text = stringResource(id = R.string.action_add))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(text = stringResource(id = R.string.action_cancel))
            }
        },
    )
}

@Composable
private fun NewApiKeyDialog(
    apiKey: String,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(text = stringResource(id = R.string.settings_new_key_title)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = stringResource(id = R.string.settings_new_key_notice),
                    style = MaterialTheme.typography.bodyMedium,
                )
                Text(
                    text = apiKey,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.primary,
                )
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text(text = stringResource(id = R.string.settings_new_key_dismiss))
            }
        },
    )
}
