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
import com.daynest.android.data.templates.ChoreTemplateInputDto
import com.daynest.android.data.templates.RoutineTemplateDto
import com.daynest.android.data.templates.RoutineTemplateInputDto
import java.time.LocalDate

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
}

@Composable
private fun RoutineTemplateCard(
    routine: RoutineTemplateDto,
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
private fun CreateRoutineDialog(
    onConfirm: (RoutineTemplateInputDto) -> Unit,
    onDismiss: () -> Unit,
) {
    var name by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var everyNDays by remember { mutableStateOf("1") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(text = stringResource(id = R.string.templates_create_routine_title)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text(text = stringResource(id = R.string.templates_name_label)) },
                    singleLine = true,
                )
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text(text = stringResource(id = R.string.templates_description_label)) },
                    singleLine = true,
                )
                OutlinedTextField(
                    value = everyNDays,
                    onValueChange = { everyNDays = it.filter { c -> c.isDigit() } },
                    label = { Text(text = stringResource(id = R.string.templates_every_n_days_label)) },
                    singleLine = true,
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    if (name.isNotBlank()) {
                        onConfirm(
                            RoutineTemplateInputDto(
                                name = name.trim(),
                                description = description.trim().ifBlank { null },
                                startDate = LocalDate.now().toString(),
                                everyNDays = everyNDays.toIntOrNull() ?: 1,
                                isActive = true,
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
private fun CreateChoreDialog(
    onConfirm: (ChoreTemplateInputDto) -> Unit,
    onDismiss: () -> Unit,
) {
    var name by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var everyNDays by remember { mutableStateOf("7") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(text = stringResource(id = R.string.templates_create_chore_title)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text(text = stringResource(id = R.string.templates_name_label)) },
                    singleLine = true,
                )
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text(text = stringResource(id = R.string.templates_description_label)) },
                    singleLine = true,
                )
                OutlinedTextField(
                    value = everyNDays,
                    onValueChange = { everyNDays = it.filter { c -> c.isDigit() } },
                    label = { Text(text = stringResource(id = R.string.templates_every_n_days_label)) },
                    singleLine = true,
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    if (name.isNotBlank()) {
                        onConfirm(
                            ChoreTemplateInputDto(
                                name = name.trim(),
                                description = description.trim().ifBlank { null },
                                startDate = LocalDate.now().toString(),
                                everyNDays = everyNDays.toIntOrNull() ?: 7,
                                isActive = true,
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
