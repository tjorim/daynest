@file:Suppress("ktlint:standard:function-naming", "FunctionNaming")

package com.daynest.android.ui

import androidx.annotation.StringRes
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

data class PlannedItemFormState(
    val title: String,
    val plannedFor: String,
    val notes: String? = null,
    val moduleKey: String? = null,
    val recurrenceHint: String? = null,
    val linkedSource: String? = null,
    val linkedRef: String? = null,
)

@Composable
@Suppress("LongMethod")
fun PlannedItemFormDialog(
    @StringRes titleRes: Int,
    @StringRes confirmTextRes: Int,
    initialState: PlannedItemFormState,
    onConfirm: (PlannedItemFormState) -> Unit,
    onDismiss: () -> Unit,
) {
    var title by remember(initialState) { mutableStateOf(initialState.title) }
    var plannedFor by remember(initialState) { mutableStateOf(initialState.plannedFor) }
    var notes by remember(initialState) { mutableStateOf(initialState.notes.orEmpty()) }
    var moduleKey by remember(initialState) { mutableStateOf(initialState.moduleKey.orEmpty()) }
    var recurrenceHint by remember(initialState) { mutableStateOf(initialState.recurrenceHint.orEmpty()) }
    var linkedSource by remember(initialState) { mutableStateOf(initialState.linkedSource.orEmpty()) }
    var linkedRef by remember(initialState) { mutableStateOf(initialState.linkedRef.orEmpty()) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(text = stringResource(id = titleRes)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it },
                    label = { Text(text = stringResource(id = R.string.calendar_planned_title_label)) },
                    singleLine = true,
                )
                OutlinedTextField(
                    value = plannedFor,
                    onValueChange = { plannedFor = it },
                    label = { Text(text = stringResource(id = R.string.calendar_planned_date_label)) },
                    singleLine = true,
                )
                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = { Text(text = stringResource(id = R.string.calendar_planned_notes_label)) },
                )
                OutlinedTextField(
                    value = moduleKey,
                    onValueChange = { moduleKey = it },
                    label = { Text(text = stringResource(id = R.string.calendar_planned_module_label)) },
                    singleLine = true,
                )
                OutlinedTextField(
                    value = recurrenceHint,
                    onValueChange = { recurrenceHint = it },
                    label = { Text(text = stringResource(id = R.string.calendar_planned_recurrence_label)) },
                    singleLine = true,
                )
                OutlinedTextField(
                    value = linkedSource,
                    onValueChange = { linkedSource = it },
                    label = { Text(text = stringResource(id = R.string.calendar_planned_linked_source_label)) },
                    singleLine = true,
                )
                OutlinedTextField(
                    value = linkedRef,
                    onValueChange = { linkedRef = it },
                    label = { Text(text = stringResource(id = R.string.calendar_planned_linked_ref_label)) },
                    singleLine = true,
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    onConfirm(
                        PlannedItemFormState(
                            title = title.trim(),
                            plannedFor = plannedFor.trim(),
                            notes = notes.trim().ifBlank { null },
                            moduleKey = moduleKey.trim().ifBlank { null },
                            recurrenceHint = recurrenceHint.trim().ifBlank { null },
                            linkedSource = linkedSource.trim().ifBlank { null },
                            linkedRef = linkedRef.trim().ifBlank { null },
                        ),
                    )
                },
                enabled = title.isNotBlank() && plannedFor.isNotBlank(),
            ) {
                Text(text = stringResource(id = confirmTextRes))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(text = stringResource(id = R.string.action_cancel))
            }
        },
    )
}
