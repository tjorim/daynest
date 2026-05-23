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
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.material3.rememberSwipeToDismissBoxState
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
import com.daynest.android.data.templates.RoutineTemplateDto
import com.daynest.android.data.templates.RoutineTemplateInputDto
import java.time.LocalDate

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

private fun androidx.compose.foundation.lazy.LazyListScope.routineTemplatesList(
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

private fun androidx.compose.foundation.lazy.LazyListScope.choreTemplatesList(
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
    when (state.createForm) {
        TemplateCreateForm.Routine ->
            CreateRoutineDialog(
                onConfirm = { onEvent(TemplatesUiEvent.CreateRoutine(it)) },
                onDismiss = { onEvent(TemplatesUiEvent.DismissCreateForm) },
            )

        TemplateCreateForm.Chore ->
            CreateChoreDialog(
                onConfirm = { onEvent(TemplatesUiEvent.CreateChore(it)) },
                onDismiss = { onEvent(TemplatesUiEvent.DismissCreateForm) },
            )

        null -> Unit
    }

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
        EditChoreDialog(
            chore = chore,
            onConfirm = {
                onEvent(TemplatesUiEvent.UpdateChore(chore.id, it))
                onEditChoreDismiss()
            },
            onDismiss = onEditChoreDismiss,
        )
    }

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
private fun DeleteRoutineDialog(
    routine: RoutineTemplateDto?,
    onConfirm: (RoutineTemplateDto) -> Unit,
    onDismiss: () -> Unit,
) {
    routine?.let { routine ->
        AlertDialog(
            onDismissRequest = onDismiss,
            title = { Text(text = stringResource(id = R.string.templates_delete_title)) },
            text = {
                Text(
                    text = stringResource(id = R.string.templates_delete_routine_message, routine.name),
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        onConfirm(routine)
                    },
                ) {
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
}

@Composable
private fun DeleteChoreDialog(
    chore: ChoreTemplateDto?,
    onConfirm: (ChoreTemplateDto) -> Unit,
    onDismiss: () -> Unit,
) {
    chore?.let { chore ->
        AlertDialog(
            onDismissRequest = onDismiss,
            title = { Text(text = stringResource(id = R.string.templates_delete_title)) },
            text = {
                Text(
                    text = stringResource(id = R.string.templates_delete_chore_message, chore.name),
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        onConfirm(chore)
                    },
                ) {
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
                Text(text = routine.name, style = MaterialTheme.typography.bodyMedium)
                if (!routine.description.isNullOrBlank()) {
                    Text(
                        text = routine.description,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.outline,
                    )
                }
                Text(
                    text =
                        stringResource(
                            id = R.string.templates_every_n_days,
                            routine.everyNDays,
                        ),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.outline,
                )
                Text(
                    text =
                        if (routine.isActive) {
                            stringResource(id = R.string.templates_active)
                        } else {
                            stringResource(id = R.string.templates_inactive)
                        },
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.outline,
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
                Text(text = chore.name, style = MaterialTheme.typography.bodyMedium)
                if (!chore.description.isNullOrBlank()) {
                    Text(
                        text = chore.description,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.outline,
                    )
                }
                Text(
                    text =
                        stringResource(
                            id = R.string.templates_every_n_days,
                            chore.everyNDays,
                        ),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.outline,
                )
                Text(
                    text =
                        if (chore.isActive) {
                            stringResource(id = R.string.templates_active)
                        } else {
                            stringResource(id = R.string.templates_inactive)
                        },
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.outline,
                )
            }
            TextButton(onClick = onEdit) {
                Text(text = stringResource(id = R.string.action_edit))
            }
        }
    }
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
        initialName = routine.name,
        initialDescription = routine.description.orEmpty(),
        initialStartDate = routine.startDate,
        initialEveryNDays = routine.everyNDays.toString(),
        initialDueTime = routine.dueTime?.take(DUE_TIME_DISPLAY_LENGTH).orEmpty(),
        initialIsActive = routine.isActive,
        isEditing = true,
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
        initialName = "",
        initialDescription = "",
        initialStartDate = LocalDate.now().toString(),
        initialEveryNDays = "1",
        initialDueTime = "",
        initialIsActive = true,
        isEditing = false,
        confirmText = stringResource(id = R.string.action_add),
        onConfirm = onConfirm,
        onDismiss = onDismiss,
    )
}

@Composable
private fun RoutineTemplateFields(
    name: String,
    onNameChange: (String) -> Unit,
    description: String,
    onDescriptionChange: (String) -> Unit,
    startDate: String,
    onStartDateChange: (String) -> Unit,
    everyNDays: String,
    onEveryNDaysChange: (String) -> Unit,
    dueTime: String,
    onDueTimeChange: (String) -> Unit,
    isActive: Boolean,
    onIsActiveToggle: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
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
        OutlinedTextField(
            value = startDate,
            onValueChange = onStartDateChange,
            label = { Text(stringResource(R.string.templates_start_date_label)) },
            singleLine = true,
        )
        OutlinedTextField(
            value = everyNDays,
            onValueChange = { onEveryNDaysChange(it.filter { c -> c.isDigit() }) },
            label = { Text(stringResource(R.string.templates_every_n_days_label)) },
            singleLine = true,
        )
        OutlinedTextField(
            value = dueTime,
            onValueChange = onDueTimeChange,
            label = { Text(stringResource(R.string.templates_due_time_label)) },
            singleLine = true,
        )
        TextButton(onClick = onIsActiveToggle) {
            Text(
                text =
                    if (isActive) {
                        stringResource(R.string.medication_active)
                    } else {
                        stringResource(R.string.templates_inactive)
                    },
            )
        }
    }
}

@Composable
private fun RoutineTemplateDialog(
    title: String,
    initialName: String,
    initialDescription: String,
    initialStartDate: String,
    initialEveryNDays: String,
    initialDueTime: String,
    initialIsActive: Boolean,
    isEditing: Boolean,
    confirmText: String,
    onConfirm: (RoutineTemplateInputDto) -> Unit,
    onDismiss: () -> Unit,
) {
    var name by remember { mutableStateOf(initialName) }
    var description by remember { mutableStateOf(initialDescription) }
    var startDate by remember { mutableStateOf(initialStartDate) }
    var everyNDays by remember { mutableStateOf(initialEveryNDays) }
    var dueTime by remember { mutableStateOf(initialDueTime) }
    var isActive by remember { mutableStateOf(initialIsActive) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(text = title) },
        text = {
            RoutineTemplateFields(
                name = name,
                onNameChange = { name = it },
                description = description,
                onDescriptionChange = { description = it },
                startDate = startDate,
                onStartDateChange = { startDate = it },
                everyNDays = everyNDays,
                onEveryNDaysChange = { everyNDays = it },
                dueTime = dueTime,
                onDueTimeChange = { dueTime = it },
                isActive = isActive,
                onIsActiveToggle = { isActive = !isActive },
            )
        },
        confirmButton = {
            TextButton(
                onClick = {
                    if (name.isNotBlank()) {
                        val fallbackStartDate = if (isEditing) initialStartDate else LocalDate.now().toString()
                        val fallbackEveryNDays = if (isEditing) initialEveryNDays.toIntOrNull() ?: 1 else 1
                        onConfirm(
                            RoutineTemplateInputDto(
                                name = name.trim(),
                                description = description.trim().ifBlank { null },
                                startDate = startDate.trim().ifBlank { fallbackStartDate },
                                everyNDays = everyNDays.toIntOrNull() ?: fallbackEveryNDays,
                                dueTime = dueTime.trim().ifBlank { null },
                                isActive = isActive,
                            ),
                        )
                    }
                },
                enabled = name.isNotBlank(),
            ) { Text(text = confirmText) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.action_cancel)) } },
    )
}
