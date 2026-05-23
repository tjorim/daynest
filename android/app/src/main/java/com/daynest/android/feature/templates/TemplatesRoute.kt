@file:Suppress("ktlint:standard:function-naming", "FunctionNaming")

package com.daynest.android.feature.templates

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.PrimaryTabRow
import androidx.compose.material3.SwipeToDismissBox
import androidx.compose.material3.SwipeToDismissBoxDefaults
import androidx.compose.material3.SwipeToDismissBoxValue
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberSwipeToDismissBoxState
import androidx.compose.material3.rememberTimePickerState
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
import com.daynest.android.data.templates.ChoreTemplateDto
import com.daynest.android.data.templates.ChoreTemplateInputDto
import com.daynest.android.data.templates.RoutineTemplateDto
import com.daynest.android.data.templates.RoutineTemplateInputDto
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

private const val DUE_TIME_DISPLAY_LENGTH = 5

@Composable
fun TemplatesRoute(
    onNavigate: (String) -> Unit = {},
    viewModel: TemplatesViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    TemplatesScreen(uiState = uiState, onEvent = viewModel::onEvent, onNavigate = onNavigate)
}

@Composable
private fun TemplatesScreen(
    uiState: TemplatesUiState,
    onEvent: (TemplatesUiEvent) -> Unit,
    onNavigate: (String) -> Unit,
) {
    val selectedTab =
        (uiState as? TemplatesUiState.Content)?.selectedTab ?: TemplateTab.Routines
    DaynestNavigationScaffold(
        currentRoute = DaynestDestination.TEMPLATES,
        onNavigate = onNavigate,
        floatingActionButton = {
            TemplatesFloatingActionButton(
                isVisible = uiState is TemplatesUiState.Content,
                selectedTab = selectedTab,
                onEvent = onEvent,
            )
        },
    ) { innerPadding ->
        TemplatesScreenContent(
            uiState = uiState,
            onEvent = onEvent,
            innerPadding = innerPadding,
        )
    }
}

@Composable
private fun TemplatesFloatingActionButton(
    isVisible: Boolean,
    selectedTab: TemplateTab,
    onEvent: (TemplatesUiEvent) -> Unit,
) {
    if (!isVisible) return

    FloatingActionButton(
        onClick = {
            onEvent(
                if (selectedTab == TemplateTab.Routines) {
                    TemplatesUiEvent.ShowCreateRoutineForm
                } else {
                    TemplatesUiEvent.ShowCreateChoreForm
                },
            )
        },
    ) {
        Text(text = stringResource(id = R.string.action_add))
    }
}

@Composable
private fun TemplatesScreenContent(
    uiState: TemplatesUiState,
    onEvent: (TemplatesUiEvent) -> Unit,
    innerPadding: PaddingValues,
) {
    when (uiState) {
        TemplatesUiState.Loading -> TemplatesLoading(modifier = Modifier.padding(innerPadding))
        TemplatesUiState.Error -> {
            TemplatesError(
                onRetry = { onEvent(TemplatesUiEvent.RetryClicked) },
                modifier = Modifier.padding(innerPadding),
            )
        }
        is TemplatesUiState.Content -> {
            TemplatesContent(
                state = uiState,
                onEvent = onEvent,
                modifier = Modifier.padding(innerPadding),
            )
        }
    }
}

@Composable
private fun TemplatesLoading(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.Center,
    ) {
        CircularProgressIndicator()
    }
}

@Composable
private fun TemplatesError(
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxSize()
                .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            text = stringResource(id = R.string.templates_error),
            style = MaterialTheme.typography.bodyLarge,
        )
        Button(
            onClick = onRetry,
            modifier = Modifier.padding(top = 16.dp),
        ) {
            Text(text = stringResource(id = R.string.home_retry))
        }
    }
}

@Composable
private fun TemplatesContent(
    state: TemplatesUiState.Content,
    onEvent: (TemplatesUiEvent) -> Unit,
    modifier: Modifier = Modifier,
) {
    var editRoutineTarget by remember { mutableStateOf<RoutineTemplateDto?>(null) }
    var editChoreTarget by remember { mutableStateOf<ChoreTemplateDto?>(null) }
    var routineDeleteTarget by remember { mutableStateOf<RoutineTemplateDto?>(null) }
    var choreDeleteTarget by remember { mutableStateOf<ChoreTemplateDto?>(null) }

    TemplatesList(
        state = state,
        onEvent = onEvent,
        onEditRoutine = { editRoutineTarget = it },
        onEditChore = { editChoreTarget = it },
        onDeleteRoutine = { routineDeleteTarget = it },
        onDeleteChore = { choreDeleteTarget = it },
        modifier = modifier,
    )

    TemplatesDialogs(
        state = state,
        onEvent = onEvent,
        editRoutineTarget = editRoutineTarget,
        onEditRoutineDismiss = { editRoutineTarget = null },
        editChoreTarget = editChoreTarget,
        onEditChoreDismiss = { editChoreTarget = null },
        routineDeleteTarget = routineDeleteTarget,
        onRoutineDeleteDismiss = { routineDeleteTarget = null },
        choreDeleteTarget = choreDeleteTarget,
        onChoreDeleteDismiss = { choreDeleteTarget = null },
    )
}

@Composable
private fun TemplatesList(
    state: TemplatesUiState.Content,
    onEvent: (TemplatesUiEvent) -> Unit,
    onEditRoutine: (RoutineTemplateDto) -> Unit,
    onEditChore: (ChoreTemplateDto) -> Unit,
    onDeleteRoutine: (RoutineTemplateDto) -> Unit,
    onDeleteChore: (ChoreTemplateDto) -> Unit,
    modifier: Modifier = Modifier,
) {
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        item {
            Text(
                text = stringResource(id = R.string.templates_title),
                style = MaterialTheme.typography.headlineMedium,
            )
        }

        state.operationError?.let { message ->
            item {
                Text(
                    text = message,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                )
            }
        }

        item {
            TemplatesTabRow(selectedTab = state.selectedTab, onEvent = onEvent)
        }

        when (state.selectedTab) {
            TemplateTab.Routines ->
                routineTemplatesList(
                    routines = state.routines,
                    onEdit = onEditRoutine,
                    onDelete = onDeleteRoutine,
                )
            TemplateTab.Chores ->
                choreTemplatesList(
                    chores = state.chores,
                    onEdit = onEditChore,
                    onDelete = onDeleteChore,
                )
        }
    }
}

@Composable
private fun TemplatesTabRow(
    selectedTab: TemplateTab,
    onEvent: (TemplatesUiEvent) -> Unit,
) {
    PrimaryTabRow(
        selectedTabIndex = selectedTab.ordinal,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Tab(
            selected = selectedTab == TemplateTab.Routines,
            onClick = { onEvent(TemplatesUiEvent.TabSelected(TemplateTab.Routines)) },
            text = { Text(text = stringResource(id = R.string.templates_tab_routines)) },
        )
        Tab(
            selected = selectedTab == TemplateTab.Chores,
            onClick = { onEvent(TemplatesUiEvent.TabSelected(TemplateTab.Chores)) },
            text = { Text(text = stringResource(id = R.string.templates_tab_chores)) },
        )
    }
}

private fun LazyListScope.routineTemplatesList(
    routines: List<RoutineTemplateDto>,
    onEdit: (RoutineTemplateDto) -> Unit,
    onDelete: (RoutineTemplateDto) -> Unit,
) {
    if (routines.isEmpty()) {
        item {
            EmptyTemplatesMessage(textResId = R.string.templates_no_routines)
        }
    } else {
        items(routines, key = { "routine_${it.id}" }) { routine ->
            SwipeToDeleteTemplateCard(onDeleteRequested = { onDelete(routine) }) {
                RoutineTemplateCard(
                    routine = routine,
                    onEdit = { onEdit(routine) },
                )
            }
        }
    }
}

private fun LazyListScope.choreTemplatesList(
    chores: List<ChoreTemplateDto>,
    onEdit: (ChoreTemplateDto) -> Unit,
    onDelete: (ChoreTemplateDto) -> Unit,
) {
    if (chores.isEmpty()) {
        item {
            EmptyTemplatesMessage(textResId = R.string.templates_no_chores)
        }
    } else {
        items(chores, key = { "chore_${it.id}" }) { chore ->
            SwipeToDeleteTemplateCard(onDeleteRequested = { onDelete(chore) }) {
                ChoreTemplateCard(
                    chore = chore,
                    onEdit = { onEdit(chore) },
                )
            }
        }
    }
}

@Composable
private fun EmptyTemplatesMessage(textResId: Int) {
    Text(
        text = stringResource(id = textResId),
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.outline,
    )
}

@Composable
private fun TemplatesDialogs(
    state: TemplatesUiState.Content,
    onEvent: (TemplatesUiEvent) -> Unit,
    editRoutineTarget: RoutineTemplateDto?,
    onEditRoutineDismiss: () -> Unit,
    editChoreTarget: ChoreTemplateDto?,
    onEditChoreDismiss: () -> Unit,
    routineDeleteTarget: RoutineTemplateDto?,
    onRoutineDeleteDismiss: () -> Unit,
    choreDeleteTarget: ChoreTemplateDto?,
    onChoreDeleteDismiss: () -> Unit,
) {
    CreateTemplateDialog(state = state, onEvent = onEvent)
    EditTemplateDialogs(
        onEvent = onEvent,
        editRoutineTarget = editRoutineTarget,
        onEditRoutineDismiss = onEditRoutineDismiss,
        editChoreTarget = editChoreTarget,
        onEditChoreDismiss = onEditChoreDismiss,
    )
    DeleteRoutineDialog(
        routine = routineDeleteTarget,
        onConfirm = { routine ->
            onEvent(TemplatesUiEvent.DeleteRoutine(routine.id))
            onRoutineDeleteDismiss()
        },
        onDismiss = onRoutineDeleteDismiss,
    )
    DeleteChoreDialog(
        chore = choreDeleteTarget,
        onConfirm = { chore ->
            onEvent(TemplatesUiEvent.DeleteChore(chore.id))
            onChoreDeleteDismiss()
        },
        onDismiss = onChoreDeleteDismiss,
    )
}

@Composable
private fun CreateTemplateDialog(
    state: TemplatesUiState.Content,
    onEvent: (TemplatesUiEvent) -> Unit,
) {
    when (state.createForm) {
        TemplateCreateForm.Routine ->
            CreateRoutineDialog(
                onConfirm = { onEvent(TemplatesUiEvent.CreateRoutine(it)) },
                onDismiss = { onEvent(TemplatesUiEvent.DismissCreateForm) },
            )
        TemplateCreateForm.Chore ->
            CreateChoreTemplateDialog(
                onConfirm = { onEvent(TemplatesUiEvent.CreateChore(it)) },
                onDismiss = { onEvent(TemplatesUiEvent.DismissCreateForm) },
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
    onEditChoreDismiss: () -> Unit,
) {
    editRoutineTarget?.let { routine ->
        EditRoutineDialog(
            routine = routine,
            onConfirm = {
                onEvent(TemplatesUiEvent.UpdateRoutine(routine.id, it))
                onEditRoutineDismiss()
            },
            onDismiss = onEditRoutineDismiss,
        )
    }

    editChoreTarget?.let { chore ->
        EditChoreTemplateDialog(
            chore = chore,
            onConfirm = {
                onEvent(TemplatesUiEvent.UpdateChore(chore.id, it))
                onEditChoreDismiss()
            },
            onDismiss = onEditChoreDismiss,
        )
    }
}

@Composable
private fun DeleteRoutineDialog(
    routine: RoutineTemplateDto?,
    onConfirm: (RoutineTemplateDto) -> Unit,
    onDismiss: () -> Unit,
) {
    routine?.let { routine ->
        DeleteTemplateDialog(
            message = stringResource(id = R.string.templates_delete_routine_message, routine.name),
            onConfirm = { onConfirm(routine) },
            onDismiss = onDismiss,
        )
    }
}

@Composable
private fun DeleteChoreDialog(
    chore: ChoreTemplateDto?,
    onConfirm: (ChoreTemplateDto) -> Unit,
    onDismiss: () -> Unit,
) {
    chore?.let { chore ->
        DeleteTemplateDialog(
            message = stringResource(id = R.string.templates_delete_chore_message, chore.name),
            onConfirm = { onConfirm(chore) },
            onDismiss = onDismiss,
        )
    }
}

@Composable
private fun DeleteTemplateDialog(
    message: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
) {
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
        },
    )
}

@Composable
private fun RoutineTemplateCard(
    routine: RoutineTemplateDto,
    onEdit: () -> Unit,
) {
    Card(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(onClick = onEdit),
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                TemplateCardBody(
                    name = routine.name,
                    description = routine.description,
                    everyNDays = routine.everyNDays,
                    isActive = routine.isActive,
                )
            }
            TextButton(onClick = onEdit) {
                Text(text = stringResource(id = R.string.action_edit))
            }
        }
    }
}

@Composable
private fun ChoreTemplateCard(
    chore: ChoreTemplateDto,
    onEdit: () -> Unit,
) {
    Card(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(onClick = onEdit),
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                TemplateCardBody(
                    name = chore.name,
                    description = chore.description,
                    everyNDays = chore.everyNDays,
                    isActive = chore.isActive,
                )
            }
            TextButton(onClick = onEdit) {
                Text(text = stringResource(id = R.string.action_edit))
            }
        }
    }
}

@Composable
private fun TemplateCardBody(
    name: String,
    description: String?,
    everyNDays: Int,
    isActive: Boolean,
) {
    Text(text = name, style = MaterialTheme.typography.bodyMedium)
    if (!description.isNullOrBlank()) {
        Text(
            text = description,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.outline,
        )
    }
    Text(
        text = stringResource(id = R.string.templates_every_n_days, everyNDays),
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.outline,
    )
    Text(
        text = activeLabel(isActive),
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.outline,
    )
}

@Composable
private fun activeLabel(isActive: Boolean): String =
    if (isActive) {
        stringResource(id = R.string.templates_active)
    } else {
        stringResource(id = R.string.templates_inactive)
    }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SwipeToDeleteTemplateCard(
    onDeleteRequested: () -> Unit,
    content: @Composable RowScope.() -> Unit,
) {
    val dismissState =
        rememberSwipeToDismissBoxState(
            initialValue = SwipeToDismissBoxValue.Settled,
            positionalThreshold = SwipeToDismissBoxDefaults.positionalThreshold,
        )

    LaunchedEffect(dismissState.currentValue) {
        if (dismissState.currentValue == SwipeToDismissBoxValue.EndToStart) {
            onDeleteRequested()
            dismissState.reset()
        }
    }

    SwipeToDismissBox(
        state = dismissState,
        enableDismissFromStartToEnd = false,
        backgroundContent = {
            Box(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .padding(horizontal = 16.dp),
                contentAlignment = Alignment.CenterEnd,
            ) {
                Text(
                    text = stringResource(id = R.string.action_delete),
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.labelLarge,
                )
            }
        },
        content = content,
    )
}

@Composable
private fun EditRoutineDialog(
    routine: RoutineTemplateDto,
    onConfirm: (RoutineTemplateInputDto) -> Unit,
    onDismiss: () -> Unit,
) {
    RoutineTemplateDialog(
        title = stringResource(id = R.string.templates_edit_routine_title),
        initial = RoutineFormState.from(routine),
        confirmText = stringResource(id = R.string.action_save),
        onConfirm = onConfirm,
        onDismiss = onDismiss,
    )
}

@Composable
private fun CreateRoutineDialog(
    onConfirm: (RoutineTemplateInputDto) -> Unit,
    onDismiss: () -> Unit,
) {
    RoutineTemplateDialog(
        title = stringResource(id = R.string.templates_create_routine_title),
        initial = RoutineFormState.new(),
        confirmText = stringResource(id = R.string.action_add),
        onConfirm = onConfirm,
        onDismiss = onDismiss,
    )
}

@Composable
private fun EditChoreTemplateDialog(
    chore: ChoreTemplateDto,
    onConfirm: (ChoreTemplateInputDto) -> Unit,
    onDismiss: () -> Unit,
) {
    ChoreTemplateDialog(
        title = stringResource(id = R.string.templates_edit_chore_title),
        initial = ChoreFormState.from(chore),
        confirmText = stringResource(id = R.string.action_save),
        onConfirm = onConfirm,
        onDismiss = onDismiss,
    )
}

@Composable
private fun CreateChoreTemplateDialog(
    onConfirm: (ChoreTemplateInputDto) -> Unit,
    onDismiss: () -> Unit,
) {
    ChoreTemplateDialog(
        title = stringResource(id = R.string.templates_create_chore_title),
        initial = ChoreFormState.new(),
        confirmText = stringResource(id = R.string.action_add),
        onConfirm = onConfirm,
        onDismiss = onDismiss,
    )
}

@Composable
private fun RoutineTemplateDialog(
    title: String,
    initial: RoutineFormState,
    confirmText: String,
    onConfirm: (RoutineTemplateInputDto) -> Unit,
    onDismiss: () -> Unit,
) {
    var form by remember { mutableStateOf(initial) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(text = title) },
        text = {
            RoutineTemplateFields(
                form = form,
                onFormChange = { form = it },
            )
        },
        confirmButton = {
            TextButton(
                onClick = { onConfirm(form.toInput()) },
                enabled = form.name.isNotBlank(),
            ) { Text(text = confirmText) }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.action_cancel))
            }
        },
    )
}

@Composable
private fun ChoreTemplateDialog(
    title: String,
    initial: ChoreFormState,
    confirmText: String,
    onConfirm: (ChoreTemplateInputDto) -> Unit,
    onDismiss: () -> Unit,
) {
    var form by remember { mutableStateOf(initial) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(text = title) },
        text = {
            ChoreTemplateFields(
                form = form,
                onFormChange = { form = it },
            )
        },
        confirmButton = {
            TextButton(
                onClick = { onConfirm(form.toInput()) },
                enabled = form.name.isNotBlank(),
            ) { Text(text = confirmText) }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.action_cancel))
            }
        },
    )
}

@Composable
private fun RoutineTemplateFields(
    form: RoutineFormState,
    onFormChange: (RoutineFormState) -> Unit,
) {
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
            onIsActiveToggle = { onFormChange(form.copy(isActive = !form.isActive)) },
        )
        TemplateDueTimeField(
            dueTime = form.dueTime,
            onEditClick = { showTimePicker = true },
        )
    }

    TemplateDatePickerLauncher(
        isVisible = showDatePicker,
        initialDate = form.startDate,
        onDateSelected = { onFormChange(form.copy(startDate = it)) },
        onDismiss = { showDatePicker = false },
    )
    TemplateTimePickerLauncher(
        isVisible = showTimePicker,
        initialTime = form.dueTime,
        onTimeSelected = { onFormChange(form.copy(dueTime = it)) },
        onDismiss = { showTimePicker = false },
    )
}

@Composable
private fun ChoreTemplateFields(
    form: ChoreFormState,
    onFormChange: (ChoreFormState) -> Unit,
) {
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
            onIsActiveToggle = { onFormChange(form.copy(isActive = !form.isActive)) },
        )
    }

    TemplateDatePickerLauncher(
        isVisible = showDatePicker,
        initialDate = form.startDate,
        onDateSelected = { onFormChange(form.copy(startDate = it)) },
        onDismiss = { showDatePicker = false },
    )
}

@Composable
private fun TemplateCommonFields(
    name: String,
    onNameChange: (String) -> Unit,
    description: String,
    onDescriptionChange: (String) -> Unit,
    startDate: String,
    onStartDateClick: () -> Unit,
    everyNDays: String,
    onEveryNDaysChange: (String) -> Unit,
    isActive: Boolean,
    onIsActiveToggle: () -> Unit,
) {
    TemplateNameDescriptionFields(
        name = name,
        onNameChange = onNameChange,
        description = description,
        onDescriptionChange = onDescriptionChange,
    )
    TemplateDateField(startDate = startDate, onEditClick = onStartDateClick)
    TemplateEveryNDaysField(
        everyNDays = everyNDays,
        onEveryNDaysChange = onEveryNDaysChange,
    )
    TemplateActiveToggle(isActive = isActive, onClick = onIsActiveToggle)
}

@Composable
private fun TemplateNameDescriptionFields(
    name: String,
    onNameChange: (String) -> Unit,
    description: String,
    onDescriptionChange: (String) -> Unit,
) {
    OutlinedTextField(
        value = name,
        onValueChange = onNameChange,
        label = { Text(stringResource(R.string.templates_name_label)) },
        singleLine = true,
    )
    OutlinedTextField(
        value = description,
        onValueChange = onDescriptionChange,
        label = { Text(stringResource(R.string.templates_description_label)) },
        singleLine = true,
    )
}

@Composable
private fun TemplateDateField(
    startDate: String,
    onEditClick: () -> Unit,
) {
    OutlinedTextField(
        value = startDate,
        onValueChange = {},
        label = { Text(stringResource(R.string.templates_start_date_label)) },
        singleLine = true,
        readOnly = true,
        trailingIcon = {
            TextButton(onClick = onEditClick) {
                Text(text = stringResource(R.string.action_edit))
            }
        },
    )
}

@Composable
private fun TemplateEveryNDaysField(
    everyNDays: String,
    onEveryNDaysChange: (String) -> Unit,
) {
    OutlinedTextField(
        value = everyNDays,
        onValueChange = { onEveryNDaysChange(it.filter { c -> c.isDigit() }) },
        label = { Text(stringResource(R.string.templates_every_n_days_label)) },
        singleLine = true,
    )
}

@Composable
private fun TemplateDueTimeField(
    dueTime: String,
    onEditClick: () -> Unit,
) {
    OutlinedTextField(
        value = dueTime,
        onValueChange = {},
        label = { Text(stringResource(R.string.templates_due_time_label)) },
        singleLine = true,
        readOnly = true,
        trailingIcon = {
            TextButton(onClick = onEditClick) {
                Text(text = stringResource(R.string.action_edit))
            }
        },
    )
}

@Composable
private fun TemplateActiveToggle(
    isActive: Boolean,
    onClick: () -> Unit,
) {
    TextButton(onClick = onClick) {
        Text(text = activeLabel(isActive))
    }
}

@Composable
private fun TemplateDatePickerLauncher(
    isVisible: Boolean,
    initialDate: String,
    onDateSelected: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    if (isVisible) {
        TemplateDatePickerDialog(
            initialDate = initialDate,
            onDateSelected = onDateSelected,
            onDismiss = onDismiss,
        )
    }
}

@Composable
private fun TemplateTimePickerLauncher(
    isVisible: Boolean,
    initialTime: String,
    onTimeSelected: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    if (isVisible) {
        TemplateTimePickerDialog(
            initialTime = initialTime,
            onTimeSelected = onTimeSelected,
            onDismiss = onDismiss,
        )
    }
}

@Composable
@OptIn(ExperimentalMaterial3Api::class)
private fun TemplateDatePickerDialog(
    initialDate: String,
    onDateSelected: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    val datePickerState =
        rememberDatePickerState(
            initialSelectedDateMillis = initialDate.toEpochMillisOrNull(),
        )

    DatePickerDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(
                onClick = {
                    datePickerState.selectedDateMillis
                        ?.toLocalDateString()
                        ?.let(onDateSelected)
                    onDismiss()
                },
            ) {
                Text(text = stringResource(id = R.string.action_done))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(text = stringResource(id = R.string.action_cancel))
            }
        },
    ) {
        DatePicker(state = datePickerState)
    }
}

@Composable
@OptIn(ExperimentalMaterial3Api::class)
private fun TemplateTimePickerDialog(
    initialTime: String,
    onTimeSelected: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    val timePickerState =
        rememberTimePickerState(
            initialHour = initialTime.timePartAt(0, defaultValue = 8, range = 0..23),
            initialMinute = initialTime.timePartAt(1, defaultValue = 0, range = 0..59),
            is24Hour = true,
        )

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(text = stringResource(id = R.string.templates_due_time_label)) },
        text = { TimePicker(state = timePickerState) },
        confirmButton = {
            TextButton(
                onClick = {
                    onTimeSelected("%02d:%02d".format(timePickerState.hour, timePickerState.minute))
                    onDismiss()
                },
            ) {
                Text(text = stringResource(id = R.string.action_done))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(text = stringResource(id = R.string.action_cancel))
            }
        },
    )
}

private data class RoutineFormState(
    val name: String,
    val description: String,
    val startDate: String,
    val everyNDays: String,
    val dueTime: String,
    val isActive: Boolean,
) {
    fun toInput(): RoutineTemplateInputDto =
        RoutineTemplateInputDto(
            name = name.trim(),
            description = description.trim().ifBlank { null },
            startDate = startDate.trim().ifBlank { LocalDate.now().toString() },
            everyNDays = everyNDays.toIntOrNull() ?: 1,
            dueTime = dueTime.trim().ifBlank { null },
            isActive = isActive,
        )

    companion object {
        fun new(): RoutineFormState =
            RoutineFormState(
                name = "",
                description = "",
                startDate = LocalDate.now().toString(),
                everyNDays = "1",
                dueTime = "",
                isActive = true,
            )

        fun from(routine: RoutineTemplateDto): RoutineFormState =
            RoutineFormState(
                name = routine.name,
                description = routine.description.orEmpty(),
                startDate = routine.startDate,
                everyNDays = routine.everyNDays.toString(),
                dueTime = routine.dueTime?.take(DUE_TIME_DISPLAY_LENGTH).orEmpty(),
                isActive = routine.isActive,
            )
    }
}

private data class ChoreFormState(
    val name: String,
    val description: String,
    val startDate: String,
    val everyNDays: String,
    val isActive: Boolean,
) {
    fun toInput(): ChoreTemplateInputDto =
        ChoreTemplateInputDto(
            name = name.trim(),
            description = description.trim().ifBlank { null },
            startDate = startDate.trim().ifBlank { LocalDate.now().toString() },
            everyNDays = everyNDays.toIntOrNull() ?: 1,
            isActive = isActive,
        )

    companion object {
        fun new(): ChoreFormState =
            ChoreFormState(
                name = "",
                description = "",
                startDate = LocalDate.now().toString(),
                everyNDays = "1",
                isActive = true,
            )

        fun from(chore: ChoreTemplateDto): ChoreFormState =
            ChoreFormState(
                name = chore.name,
                description = chore.description.orEmpty(),
                startDate = chore.startDate,
                everyNDays = chore.everyNDays.toString(),
                isActive = chore.isActive,
            )
    }
}

private fun String.toEpochMillisOrNull(): Long? =
    runCatching {
        LocalDate.parse(this)
            .atStartOfDay(ZoneId.systemDefault())
            .toInstant()
            .toEpochMilli()
    }.getOrNull()

private fun Long.toLocalDateString(): String =
    Instant.ofEpochMilli(this)
        .atZone(ZoneId.systemDefault())
        .toLocalDate()
        .toString()

private fun String.timePartAt(
    index: Int,
    defaultValue: Int,
    range: IntRange,
): Int = split(":").getOrNull(index)?.toIntOrNull()?.coerceIn(range) ?: defaultValue
