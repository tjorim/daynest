@file:Suppress("ktlint:standard:function-naming", "FunctionNaming")

package com.daynest.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuAnchorType
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.daynest.android.R
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull

fun isValidServerUrl(url: String): Boolean = url.toHttpUrlOrNull() != null

@Composable
fun ServerUrlPicker(
    defaultServerUrl: String,
    customServerUrl: String?,
    onServerUrlChanged: (String?) -> Unit,
    modifier: Modifier = Modifier,
) {
    val isCustom = customServerUrl != null
    var expanded by remember { mutableStateOf(false) }
    var customInput by remember(customServerUrl) { mutableStateOf(customServerUrl ?: "") }
    var urlError by remember(customServerUrl) { mutableStateOf(false) }

    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        ServerTypeDropdown(
            isCustom = isCustom,
            defaultServerUrl = defaultServerUrl,
            expanded = expanded,
            onExpandedChange = { expanded = it },
            onSelectDefault = { onServerUrlChanged(null) },
            onSelectCustom = { if (!isCustom) onServerUrlChanged(defaultServerUrl) },
        )
        if (isCustom) {
            CustomServerUrlInput(
                customInput = customInput,
                urlError = urlError,
                onValueChange = {
                    customInput = it
                    urlError = false
                },
                onApply = {
                    val trimmed = customInput.trim()
                    if (isValidServerUrl(trimmed)) {
                        onServerUrlChanged(trimmed)
                    } else {
                        urlError = true
                    }
                },
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ServerTypeDropdown(
    isCustom: Boolean,
    defaultServerUrl: String,
    expanded: Boolean,
    onExpandedChange: (Boolean) -> Unit,
    onSelectDefault: () -> Unit,
    onSelectCustom: () -> Unit,
) {
    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = onExpandedChange,
    ) {
        OutlinedTextField(
            value =
                if (isCustom) {
                    stringResource(id = R.string.settings_server_custom)
                } else {
                    stringResource(id = R.string.settings_server_default)
                },
            onValueChange = {},
            readOnly = true,
            label = { Text(text = stringResource(id = R.string.settings_server_label)) },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier =
                Modifier
                    .fillMaxWidth()
                    .menuAnchor(ExposedDropdownMenuAnchorType.PrimaryNotEditable),
        )
        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { onExpandedChange(false) },
        ) {
            DropdownMenuItem(
                text = {
                    Column {
                        Text(text = stringResource(id = R.string.settings_server_default))
                        Text(
                            text = defaultServerUrl,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.outline,
                        )
                    }
                },
                onClick = {
                    onExpandedChange(false)
                    onSelectDefault()
                },
            )
            DropdownMenuItem(
                text = { Text(text = stringResource(id = R.string.settings_server_custom)) },
                onClick = {
                    onExpandedChange(false)
                    onSelectCustom()
                },
            )
        }
    }
}

@Composable
private fun CustomServerUrlInput(
    customInput: String,
    urlError: Boolean,
    onValueChange: (String) -> Unit,
    onApply: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        OutlinedTextField(
            value = customInput,
            onValueChange = onValueChange,
            isError = urlError,
            supportingText =
                if (urlError) {
                    { Text(text = stringResource(id = R.string.settings_server_url_error)) }
                } else {
                    null
                },
            label = { Text(text = stringResource(id = R.string.settings_server_url_label)) },
            placeholder = { Text(text = stringResource(id = R.string.settings_server_url_placeholder)) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        TextButton(
            onClick = onApply,
            enabled = customInput.trim().isNotBlank(),
            modifier = Modifier.align(Alignment.End),
        ) {
            Text(text = stringResource(id = R.string.settings_server_url_apply))
        }
    }
}
