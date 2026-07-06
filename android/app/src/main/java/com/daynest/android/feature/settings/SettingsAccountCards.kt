package com.daynest.android.feature.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.daynest.android.R

@Composable
internal fun accountSessionCard(onEvent: (SettingsUiEvent) -> Unit) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier =
            Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = stringResource(id = R.string.settings_session_active),
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.weight(1f)
            )
            TextButton(onClick = { onEvent(SettingsUiEvent.SignOutClicked) }) {
                Text(
                    text = stringResource(id = R.string.settings_sign_out),
                    color = MaterialTheme.colorScheme.error
                )
            }
        }
    }
}

@Composable
internal fun deleteAccountCard(state: SettingsUiState.Content, onEvent: (SettingsUiEvent) -> Unit) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier =
            Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(
                text = stringResource(id = R.string.settings_delete_account_title),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.error
            )
            Text(
                text = stringResource(id = R.string.settings_delete_account_hint),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.outline
            )
            state.accountDeletionError?.let { message ->
                Text(
                    text = message,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error
                )
            }
            TextButton(
                onClick = { onEvent(SettingsUiEvent.ShowDeleteAccountDialog) },
                enabled = !state.isDeletingAccount,
                colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error)
            ) {
                Text(text = deleteAccountActionText(state.isDeletingAccount))
            }
        }
    }
}

@Composable
private fun deleteAccountActionText(isDeletingAccount: Boolean): String = if (isDeletingAccount) {
    stringResource(id = R.string.settings_delete_account_deleting)
} else {
    stringResource(id = R.string.settings_delete_account_action)
}
