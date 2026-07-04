@file:Suppress("ktlint:standard:function-naming", "FunctionNaming")

package com.daynest.android.feature.templates

import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import com.daynest.android.R
import com.daynest.android.data.templates.ChoreTemplateDto
import com.daynest.android.data.templates.RoutineTemplateDto

@Composable
fun DeleteRoutineDialog(routine: RoutineTemplateDto?, onConfirm: (RoutineTemplateDto) -> Unit, onDismiss: () -> Unit) {
    routine?.let { routine ->
        DeleteTemplateDialog(
            message = stringResource(id = R.string.templates_delete_routine_message, routine.name),
            onConfirm = { onConfirm(routine) },
            onDismiss = onDismiss
        )
    }
}

@Composable
fun DeleteChoreDialog(chore: ChoreTemplateDto?, onConfirm: (ChoreTemplateDto) -> Unit, onDismiss: () -> Unit) {
    chore?.let { chore ->
        DeleteTemplateDialog(
            message = stringResource(id = R.string.templates_delete_chore_message, chore.name),
            onConfirm = { onConfirm(chore) },
            onDismiss = onDismiss
        )
    }
}

@Composable
private fun DeleteTemplateDialog(message: String, onConfirm: () -> Unit, onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(text = stringResource(id = R.string.templates_delete_title)) },
        text = { Text(text = message) },
        confirmButton = {
            TextButton(onClick = onConfirm) {
                Text(text = stringResource(id = R.string.action_delete))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(text = stringResource(id = R.string.action_cancel))
            }
        }
    )
}
