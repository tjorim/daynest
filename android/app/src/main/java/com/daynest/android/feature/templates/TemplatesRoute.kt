@file:Suppress("ktlint:standard:function-naming", "FunctionNaming")

package com.daynest.android.feature.templates

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
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
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
    DaynestNavigationScaffold(
        currentRoute = DaynestDestination.TEMPLATES,
        onNavigate = onNavigate,
    ) { innerPadding ->
        when (uiState) {
            TemplatesUiState.Loading -> {
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

            TemplatesUiState.Error -> {
                Column(
                    modifier =
                        Modifier
                            .fillMaxSize()
                            .padding(innerPadding)
                            .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                ) {
                    Text(
                        text = stringResource(id = R.string.templates_error),
                        style = MaterialTheme.typography.bodyLarge,
                    )
                    Button(
                        onClick = { onEvent(TemplatesUiEvent.RetryClicked) },
                        modifier = Modifier.padding(top = 16.dp),
                    ) {
                        Text(text = stringResource(id = R.string.home_retry))
                    }
                }
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
}

@Composable
@Suppress("LongMethod", "CyclomaticComplexMethod")
private fun TemplatesContent(
    state: TemplatesUiState.Content,
    onEvent: (TemplatesUiEvent) -> Unit,
    modifier: Modifier = Modifier,
) {
    var editRoutineTarget by remember { mutableStateOf<RoutineTemplateDto?>(null) }
    var editChoreTarget by remember { mutableStateOf<ChoreTemplateDto?>(null) }

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

        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(
                    selected = state.selectedTab == TemplateTab.Routines,
                    onClick = { onEvent(TemplatesUiEvent.TabSelected(TemplateTab.Routines)) },
                    label = { Text(text = stringResource(id = R.string.templates_tab_routines)) },
                )
                FilterChip(
                    selected = state.selectedTab == TemplateTab.Chores,
                    onClick = { onEvent(TemplatesUiEvent.TabSelected(TemplateTab.Chores)) },
                    label = { Text(text = stringResource(id = R.string.templates_tab_chores)) },
                )
            }
        }

        when (state.selectedTab) {
            TemplateTab.Routines -> {
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = stringResource(id = R.string.templates_tab_routines),
                            style = MaterialTheme.typography.titleMedium,
                            modifier = Modifier.weight(1f),
                        )
                        TextButton(onClick = { onEvent(TemplatesUiEvent.ShowCreateRoutineForm) }) {
                            Text(text = stringResource(id = R.string.templates_add_routine))
                        }
                    }
                }
                if (state.routines.isEmpty()) {
                    item {
                        Text(
                            text = stringResource(id = R.string.templates_no_routines),
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.outline,
                        )
                    }
                } else {
                    items(state.routines, key = { "routine_${it.id}" }) { routine ->
                        RoutineTemplateCard(
                            routine = routine,
                            onEdit = { editRoutineTarget = routine },
                            onDelete = { onEvent(TemplatesUiEvent.DeleteRoutine(routine.id)) },
                        )
                    }
                }
            }

            TemplateTab.Chores -> {
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = stringResource(id = R.string.templates_tab_chores),
                            style = MaterialTheme.typography.titleMedium,
                            modifier = Modifier.weight(1f),
                        )
                        TextButton(onClick = { onEvent(TemplatesUiEvent.ShowCreateChoreForm) }) {
                            Text(text = stringResource(id = R.string.templates_add_chore))
                        }
                    }
                }
                if (state.chores.isEmpty()) {
                    item {
                        Text(
                            text = stringResource(id = R.string.templates_no_chores),
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.outline,
                        )
                    }
                } else {
                    items(state.chores, key = { "chore_${it.id}" }) { chore ->
                        ChoreTemplateCard(
                            chore = chore,
                            onEdit = { editChoreTarget = chore },
                            onDelete = { onEvent(TemplatesUiEvent.DeleteChore(chore.id)) },
                        )
                    }
                }
            }
        }
    }

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
                editRoutineTarget = null
            },
            onDismiss = { editRoutineTarget = null },
        )
    }

    editChoreTarget?.let { chore ->
        EditChoreDialog(
            chore = chore,
            onConfirm = {
                onEvent(TemplatesUiEvent.UpdateChore(chore.id, it))
                editChoreTarget = null
            },
            onDismiss = { editChoreTarget = null },
        )
    }
}

@Composable
private fun RoutineTemplateCard(
    routine: RoutineTemplateDto,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
) {
    Card(modifier = Modifier.fillMaxWidth()) {
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
                if (!routine.isActive) {
                    Text(
                        text = stringResource(id = R.string.templates_inactive),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.outline,
                    )
                }
            }
            TextButton(onClick = onEdit) {
                Text(text = stringResource(id = R.string.action_edit))
            }
            TextButton(
                onClick = onDelete,
                colors =
                    ButtonDefaults.textButtonColors(
                        contentColor = MaterialTheme.colorScheme.error,
                    ),
            ) {
                Text(text = stringResource(id = R.string.action_delete))
            }
        }
    }
}

@Composable
private fun ChoreTemplateCard(
    chore: ChoreTemplateDto,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
) {
    Card(modifier = Modifier.fillMaxWidth()) {
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
                if (!chore.isActive) {
                    Text(
                        text = stringResource(id = R.string.templates_inactive),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.outline,
                    )
                }
            }
            TextButton(onClick = onEdit) {
                Text(text = stringResource(id = R.string.action_edit))
            }
            TextButton(
                onClick = onDelete,
                colors =
                    ButtonDefaults.textButtonColors(
                        contentColor = MaterialTheme.colorScheme.error,
                    ),
            ) {
                Text(text = stringResource(id = R.string.action_delete))
            }
        }
    }
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
                text = if (isActive) {
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
                name = name, onNameChange = { name = it },
                description = description, onDescriptionChange = { description = it },
                startDate = startDate, onStartDateChange = { startDate = it },
                everyNDays = everyNDays, onEveryNDaysChange = { everyNDays = it },
                dueTime = dueTime, onDueTimeChange = { dueTime = it },
                isActive = isActive, onIsActiveToggle = { isActive = !isActive },
            )
        },
        confirmButton = {
            TextButton(
                onClick = {
                    if (name.isNotBlank()) {
                        onConfirm(
                            RoutineTemplateInputDto(
                                name = name.trim(),
                                description = description.trim().ifBlank { null },
                                startDate = startDate.trim().ifBlank { LocalDate.now().toString() },
                                everyNDays = everyNDays.toIntOrNull() ?: 1,
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

