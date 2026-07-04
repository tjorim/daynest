@file:Suppress("ktlint:standard:function-naming", "FunctionNaming")

package com.daynest.android.feature.templates

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.daynest.android.R
import com.daynest.android.data.templates.ChoreTemplateDto
import com.daynest.android.data.templates.ChoreTemplateInputDto
import java.time.LocalDate

@Composable
internal fun EditChoreDialog(
    chore: ChoreTemplateDto,
    onConfirm: (ChoreTemplateInputDto) -> Unit,
    onDismiss: () -> Unit
) {
    ChoreTemplateDialog(
        title = stringResource(id = R.string.templates_edit_chore_title),
        initialName = chore.name,
        initialDescription = chore.description.orEmpty(),
        initialStartDate = chore.startDate,
        initialEveryNDays = chore.everyNDays.toString(),
        initialIsActive = chore.isActive,
        isEditing = true,
        confirmText = stringResource(id = R.string.action_save),
        onConfirm = onConfirm,
        onDismiss = onDismiss
    )
}

@Composable
internal fun CreateChoreDialog(onConfirm: (ChoreTemplateInputDto) -> Unit, onDismiss: () -> Unit) {
    ChoreTemplateDialog(
        title = stringResource(id = R.string.templates_create_chore_title),
        initialName = "",
        initialDescription = "",
        initialStartDate = LocalDate.now().toString(),
        initialEveryNDays = "7",
        initialIsActive = true,
        isEditing = false,
        confirmText = stringResource(id = R.string.action_add),
        onConfirm = onConfirm,
        onDismiss = onDismiss
    )
}

@Composable
private fun ChoreTemplateFields(
    name: String,
    onNameChange: (String) -> Unit,
    description: String,
    onDescriptionChange: (String) -> Unit,
    startDate: String,
    onStartDateChange: (String) -> Unit,
    everyNDays: String,
    onEveryNDaysChange: (String) -> Unit,
    isActive: Boolean,
    onIsActiveToggle: () -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedTextField(
            value = name,
            onValueChange = onNameChange,
            label = { Text(text = stringResource(id = R.string.templates_name_label)) },
            singleLine = true
        )
        OutlinedTextField(
            value = description,
            onValueChange = onDescriptionChange,
            label = { Text(text = stringResource(id = R.string.templates_description_label)) },
            singleLine = true
        )
        OutlinedTextField(
            value = startDate,
            onValueChange = onStartDateChange,
            label = { Text(text = stringResource(id = R.string.templates_start_date_label)) },
            singleLine = true
        )
        OutlinedTextField(
            value = everyNDays,
            onValueChange = { onEveryNDaysChange(it.filter { c -> c.isDigit() }) },
            label = { Text(text = stringResource(id = R.string.templates_every_n_days_label)) },
            singleLine = true
        )
        TextButton(onClick = onIsActiveToggle) {
            Text(
                text =
                if (isActive) {
                    stringResource(id = R.string.medication_active)
                } else {
                    stringResource(id = R.string.templates_inactive)
                }
            )
        }
    }
}

@Composable
private fun ChoreTemplateDialog(
    title: String,
    initialName: String,
    initialDescription: String,
    initialStartDate: String,
    initialEveryNDays: String,
    initialIsActive: Boolean,
    isEditing: Boolean,
    confirmText: String,
    onConfirm: (ChoreTemplateInputDto) -> Unit,
    onDismiss: () -> Unit
) {
    var name by remember { mutableStateOf(initialName) }
    var description by remember { mutableStateOf(initialDescription) }
    var startDate by remember { mutableStateOf(initialStartDate) }
    var everyNDays by remember { mutableStateOf(initialEveryNDays) }
    var isActive by remember { mutableStateOf(initialIsActive) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(text = title) },
        text = {
            ChoreTemplateFields(
                name = name,
                onNameChange = { name = it },
                description = description,
                onDescriptionChange = { description = it },
                startDate = startDate,
                onStartDateChange = { startDate = it },
                everyNDays = everyNDays,
                onEveryNDaysChange = { everyNDays = it },
                isActive = isActive,
                onIsActiveToggle = { isActive = !isActive }
            )
        },
        confirmButton = {
            TextButton(
                onClick = {
                    if (name.isNotBlank()) {
                        val fallbackStartDate = if (isEditing) initialStartDate else LocalDate.now().toString()
                        val fallbackEveryNDays = if (isEditing) initialEveryNDays.toIntOrNull() ?: 7 else 7
                        onConfirm(
                            ChoreTemplateInputDto(
                                name = name.trim(),
                                description = description.trim().ifBlank { null },
                                startDate = startDate.trim().ifBlank { fallbackStartDate },
                                everyNDays = everyNDays.toIntOrNull() ?: fallbackEveryNDays,
                                isActive = isActive
                            )
                        )
                    }
                },
                enabled = name.isNotBlank()
            ) {
                Text(text = confirmText)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(text = stringResource(id = R.string.action_cancel))
            }
        }
    )
}
