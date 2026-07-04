@file:Suppress("ktlint:standard:function-naming", "FunctionNaming")

package com.daynest.android.feature.templates

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
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
import com.daynest.android.data.templates.RoutineTemplateDto
import com.daynest.android.data.templates.RoutineTemplateInputDto

@Composable
fun TemplatesDialogs(
    state: TemplatesUiState.Content,
    onEvent: (TemplatesUiEvent) -> Unit,
    editRoutineTarget: RoutineTemplateDto?,
    onEditRoutineDismiss: () -> Unit,
    editChoreTarget: ChoreTemplateDto?,
    onEditChoreDismiss: () -> Unit,
    routineDeleteTarget: RoutineTemplateDto?,
    onRoutineDeleteDismiss: () -> Unit,
    choreDeleteTarget: ChoreTemplateDto?,
    onChoreDeleteDismiss: () -> Unit
) {
    CreateTemplateDialog(state = state, onEvent = onEvent)
    EditTemplateDialogs(
        onEvent = onEvent,
        editRoutineTarget = editRoutineTarget,
        onEditRoutineDismiss = onEditRoutineDismiss,
        editChoreTarget = editChoreTarget,
        onEditChoreDismiss = onEditChoreDismiss
    )
    DeleteRoutineDialog(
        routine = routineDeleteTarget,
        onConfirm = { routine ->
            onEvent(TemplatesUiEvent.DeleteRoutine(routine.id))
            onRoutineDeleteDismiss()
        },
        onDismiss = onRoutineDeleteDismiss
    )
    DeleteChoreDialog(
        chore = choreDeleteTarget,
        onConfirm = { chore ->
            onEvent(TemplatesUiEvent.DeleteChore(chore.id))
            onChoreDeleteDismiss()
        },
        onDismiss = onChoreDeleteDismiss
    )
}

@Composable
private fun CreateTemplateDialog(state: TemplatesUiState.Content, onEvent: (TemplatesUiEvent) -> Unit) {
    when (state.createForm) {
        TemplateCreateForm.Routine ->
            CreateRoutineDialog(
                onConfirm = { onEvent(TemplatesUiEvent.CreateRoutine(it)) },
                onDismiss = { onEvent(TemplatesUiEvent.DismissCreateForm) }
            )
        TemplateCreateForm.Chore ->
            CreateChoreTemplateDialog(
                onConfirm = { onEvent(TemplatesUiEvent.CreateChore(it)) },
                onDismiss = { onEvent(TemplatesUiEvent.DismissCreateForm) }
            )
        null -> Unit
    }
}

@Composable
private fun EditTemplateDialogs(
    onEvent: (TemplatesUiEvent) -> Unit,
    editRoutineTarget: RoutineTemplateDto?,
    onEditRoutineDismiss: () -> Unit,
    editChoreTarget: ChoreTemplateDto?,
    onEditChoreDismiss: () -> Unit
) {
    editRoutineTarget?.let { routine ->
        EditRoutineDialog(
            routine = routine,
            onConfirm = {
                onEvent(TemplatesUiEvent.UpdateRoutine(routine.id, it))
                onEditRoutineDismiss()
            },
            onDismiss = onEditRoutineDismiss
        )
    }

    editChoreTarget?.let { chore ->
        EditChoreTemplateDialog(
            chore = chore,
            onConfirm = {
                onEvent(TemplatesUiEvent.UpdateChore(chore.id, it))
                onEditChoreDismiss()
            },
            onDismiss = onEditChoreDismiss
        )
    }
}

@Composable
private fun EditRoutineDialog(
    routine: RoutineTemplateDto,
    onConfirm: (RoutineTemplateInputDto) -> Unit,
    onDismiss: () -> Unit
) {
    RoutineTemplateDialog(
        title = stringResource(id = R.string.templates_edit_routine_title),
        initial = RoutineFormState.from(routine),
        confirmText = stringResource(id = R.string.action_save),
        onConfirm = onConfirm,
        onDismiss = onDismiss
    )
}

@Composable
private fun CreateRoutineDialog(onConfirm: (RoutineTemplateInputDto) -> Unit, onDismiss: () -> Unit) {
    RoutineTemplateDialog(
        title = stringResource(id = R.string.templates_create_routine_title),
        initial = RoutineFormState.new(),
        confirmText = stringResource(id = R.string.action_add),
        onConfirm = onConfirm,
        onDismiss = onDismiss
    )
}

@Composable
private fun EditChoreTemplateDialog(
    chore: ChoreTemplateDto,
    onConfirm: (ChoreTemplateInputDto) -> Unit,
    onDismiss: () -> Unit
) {
    ChoreTemplateDialog(
        title = stringResource(id = R.string.templates_edit_chore_title),
        initial = ChoreFormState.from(chore),
        confirmText = stringResource(id = R.string.action_save),
        onConfirm = onConfirm,
        onDismiss = onDismiss
    )
}

@Composable
private fun CreateChoreTemplateDialog(onConfirm: (ChoreTemplateInputDto) -> Unit, onDismiss: () -> Unit) {
    ChoreTemplateDialog(
        title = stringResource(id = R.string.templates_create_chore_title),
        initial = ChoreFormState.new(),
        confirmText = stringResource(id = R.string.action_add),
        onConfirm = onConfirm,
        onDismiss = onDismiss
    )
}

@Composable
private fun RoutineTemplateDialog(
    title: String,
    initial: RoutineFormState,
    confirmText: String,
    onConfirm: (RoutineTemplateInputDto) -> Unit,
    onDismiss: () -> Unit
) {
    var form by remember { mutableStateOf(initial) }

    TemplateFormDialog(
        title = title,
        confirmText = confirmText,
        isConfirmEnabled = form.name.isNotBlank(),
        onConfirm = { onConfirm(form.toInput()) },
        onDismiss = onDismiss,
        content = { RoutineTemplateFields(form = form, onFormChange = { form = it }) }
    )
}

@Composable
private fun ChoreTemplateDialog(
    title: String,
    initial: ChoreFormState,
    confirmText: String,
    onConfirm: (ChoreTemplateInputDto) -> Unit,
    onDismiss: () -> Unit
) {
    var form by remember { mutableStateOf(initial) }

    TemplateFormDialog(
        title = title,
        confirmText = confirmText,
        isConfirmEnabled = form.name.isNotBlank(),
        onConfirm = { onConfirm(form.toInput()) },
        onDismiss = onDismiss,
        content = { ChoreTemplateFields(form = form, onFormChange = { form = it }) }
    )
}

@Composable
fun RoutineTemplateFields(form: RoutineFormState, onFormChange: (RoutineFormState) -> Unit) {
    var showDatePicker by remember { mutableStateOf(false) }
    var showTimePicker by remember { mutableStateOf(false) }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        TemplateCommonFields(
            name = form.name,
            onNameChange = { onFormChange(form.copy(name = it)) },
            description = form.description,
            onDescriptionChange = { onFormChange(form.copy(description = it)) },
            startDate = form.startDate,
            onStartDateClick = { showDatePicker = true },
            everyNDays = form.everyNDays,
            onEveryNDaysChange = { onFormChange(form.copy(everyNDays = it)) },
            isActive = form.isActive,
            onIsActiveToggle = { onFormChange(form.copy(isActive = !form.isActive)) }
        )
        TemplateDueTimeField(
            dueTime = form.dueTime,
            onEditClick = { showTimePicker = true }
        )
    }

    TemplateDatePickerLauncher(
        isVisible = showDatePicker,
        initialDate = form.startDate,
        onDateSelected = { onFormChange(form.copy(startDate = it)) },
        onDismiss = { showDatePicker = false }
    )
    TemplateTimePickerLauncher(
        isVisible = showTimePicker,
        initialTime = form.dueTime,
        onTimeSelected = { onFormChange(form.copy(dueTime = it)) },
        onDismiss = { showTimePicker = false }
    )
}

@Composable
fun ChoreTemplateFields(form: ChoreFormState, onFormChange: (ChoreFormState) -> Unit) {
    var showDatePicker by remember { mutableStateOf(false) }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        TemplateCommonFields(
            name = form.name,
            onNameChange = { onFormChange(form.copy(name = it)) },
            description = form.description,
            onDescriptionChange = { onFormChange(form.copy(description = it)) },
            startDate = form.startDate,
            onStartDateClick = { showDatePicker = true },
            everyNDays = form.everyNDays,
            onEveryNDaysChange = { onFormChange(form.copy(everyNDays = it)) },
            isActive = form.isActive,
            onIsActiveToggle = { onFormChange(form.copy(isActive = !form.isActive)) }
        )
    }

    TemplateDatePickerLauncher(
        isVisible = showDatePicker,
        initialDate = form.startDate,
        onDateSelected = { onFormChange(form.copy(startDate = it)) },
        onDismiss = { showDatePicker = false }
    )
}
