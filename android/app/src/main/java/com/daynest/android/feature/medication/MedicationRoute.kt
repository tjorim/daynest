@file:Suppress("ktlint:standard:function-naming", "FunctionNaming")

package com.daynest.android.feature.medication

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
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
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
import com.daynest.android.data.medication.MedicationHistoryItemDto
import com.daynest.android.data.medication.MedicationPlanDto
import com.daynest.android.data.medication.MedicationPlanInputDto
import com.daynest.android.data.medication.MedicationPlanUpdateDto
import java.time.LocalDate

private const val SCHEDULE_TIME_DISPLAY_LENGTH = 5

@Composable
fun MedicationRoute(onNavigate: (String) -> Unit = {}, viewModel: MedicationViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    MedicationScreen(uiState = uiState, onEvent = viewModel::onEvent, onNavigate = onNavigate)
}

@Composable
private fun MedicationScreen(
    uiState: MedicationUiState,
    onEvent: (MedicationUiEvent) -> Unit,
    onNavigate: (String) -> Unit
) {
    DaynestNavigationScaffold(
        currentRoute = DaynestDestination.MEDICATION,
        onNavigate = onNavigate
    ) { innerPadding ->
        when (uiState) {
            MedicationUiState.Loading -> {
                Box(
                    modifier =
                    Modifier
                        .fillMaxSize()
                        .padding(innerPadding),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }

            MedicationUiState.Error -> {
                Column(
                    modifier =
                    Modifier
                        .fillMaxSize()
                        .padding(innerPadding)
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Text(
                        text = stringResource(id = R.string.medication_error),
                        style = MaterialTheme.typography.bodyLarge
                    )
                    Button(
                        onClick = { onEvent(MedicationUiEvent.RetryClicked) },
                        modifier = Modifier.padding(top = 16.dp)
                    ) {
                        Text(text = stringResource(id = R.string.home_retry))
                    }
                }
            }

            is MedicationUiState.Content -> {
                MedicationContent(
                    state = uiState,
                    onEvent = onEvent,
                    modifier = Modifier.padding(innerPadding)
                )
            }
        }
    }
}

@Composable
@Suppress("LongMethod")
private fun MedicationContent(
    state: MedicationUiState.Content,
    onEvent: (MedicationUiEvent) -> Unit,
    modifier: Modifier = Modifier
) {
    var editTarget by remember { mutableStateOf<MedicationPlanDto?>(null) }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        item {
            Text(
                text = stringResource(id = R.string.medication_title),
                style = MaterialTheme.typography.headlineMedium
            )
        }

        state.operationError?.let { message ->
            item {
                Text(
                    text = message,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error
                )
            }
        }

        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = stringResource(id = R.string.medication_plans_section),
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.weight(1f)
                )
                TextButton(onClick = { onEvent(MedicationUiEvent.ShowCreateForm) }) {
                    Text(text = stringResource(id = R.string.medication_add_plan))
                }
            }
        }

        if (state.plans.isEmpty()) {
            item {
                Text(
                    text = stringResource(id = R.string.medication_no_plans),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.outline
                )
            }
        } else {
            items(state.plans, key = { "plan_${it.id}" }) { plan ->
                MedicationPlanCard(
                    plan = plan,
                    onEdit = { editTarget = plan },
                    onDelete = { onEvent(MedicationUiEvent.DeletePlanClicked(plan.id)) }
                )
            }
        }

        item {
            Text(
                text = stringResource(id = R.string.medication_history_section),
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.padding(top = 8.dp)
            )
        }

        if (state.history.isEmpty()) {
            item {
                Text(
                    text = stringResource(id = R.string.medication_no_history),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.outline
                )
            }
        } else {
            itemsIndexed(
                state.history,
                key = { index, item ->
                    "history_${item.medicationDoseInstanceId}_${item.scheduledAt}_$index"
                }
            ) { _, item ->
                MedicationHistoryCard(item = item)
            }
        }
    }

    if (state.showCreateForm) {
        CreateMedicationPlanDialog(
            onConfirm = { onEvent(MedicationUiEvent.CreatePlanClicked(it)) },
            onDismiss = { onEvent(MedicationUiEvent.DismissCreateForm) }
        )
    }

    editTarget?.let { plan ->
        EditMedicationPlanDialog(
            plan = plan,
            onConfirm = {
                onEvent(MedicationUiEvent.UpdatePlanClicked(plan.id, it))
                editTarget = null
            },
            onDismiss = { editTarget = null }
        )
    }
}

@Composable
private fun MedicationPlanCard(plan: MedicationPlanDto, onEdit: () -> Unit, onDelete: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = plan.name,
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.weight(1f)
                )
                if (!plan.isActive) {
                    Text(
                        text = stringResource(id = R.string.medication_inactive),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.outline
                    )
                }
            }
            if (plan.instructions.isNotEmpty()) {
                Text(
                    text = plan.instructions,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.outline
                )
            }
            Text(
                text =
                stringResource(
                    id = R.string.medication_plan_schedule,
                    plan.scheduleTime,
                    plan.everyNDays
                ),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.outline
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TextButton(onClick = onEdit) {
                    Text(text = stringResource(id = R.string.action_edit))
                }
                TextButton(
                    onClick = onDelete,
                    colors =
                    androidx.compose.material3.ButtonDefaults.textButtonColors(
                        contentColor = MaterialTheme.colorScheme.error
                    )
                ) {
                    Text(text = stringResource(id = R.string.action_delete))
                }
            }
        }
    }
}

@Composable
private fun MedicationHistoryCard(item: MedicationHistoryItemDto) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier =
            Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(text = item.name, style = MaterialTheme.typography.bodyMedium)
                if (item.scheduledAt.isNotEmpty()) {
                    Text(
                        text = item.scheduledAt,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.outline
                    )
                }
            }
            val statusColor =
                when (item.status) {
                    "taken" -> MaterialTheme.colorScheme.primary
                    "skipped" -> MaterialTheme.colorScheme.outline
                    "missed" -> MaterialTheme.colorScheme.error
                    else -> MaterialTheme.colorScheme.outline
                }
            Text(
                text = item.status,
                style = MaterialTheme.typography.labelSmall,
                color = statusColor
            )
        }
    }
}

@Composable
@Suppress("LongMethod")
private fun EditMedicationPlanDialog(
    plan: MedicationPlanDto,
    onConfirm: (MedicationPlanUpdateDto) -> Unit,
    onDismiss: () -> Unit
) {
    var name by remember(plan) { mutableStateOf(plan.name) }
    var instructions by remember(plan) { mutableStateOf(plan.instructions) }
    var startDate by remember(plan) { mutableStateOf(plan.startDate) }
    var scheduleTime by remember(plan) { mutableStateOf(plan.scheduleTime.take(SCHEDULE_TIME_DISPLAY_LENGTH)) }
    var everyNDays by remember(plan) { mutableStateOf(plan.everyNDays.toString()) }
    var isActive by remember(plan) { mutableStateOf(plan.isActive) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(text = stringResource(id = R.string.medication_edit_title)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text(text = stringResource(id = R.string.medication_name_label)) },
                    singleLine = true
                )
                OutlinedTextField(
                    value = instructions,
                    onValueChange = { instructions = it },
                    label = { Text(text = stringResource(id = R.string.medication_instructions_label)) },
                    singleLine = true
                )
                OutlinedTextField(
                    value = startDate,
                    onValueChange = { startDate = it },
                    label = { Text(text = stringResource(id = R.string.calendar_planned_date_label)) },
                    singleLine = true
                )
                OutlinedTextField(
                    value = scheduleTime,
                    onValueChange = { scheduleTime = it },
                    label = { Text(text = stringResource(id = R.string.medication_time_label)) },
                    singleLine = true
                )
                OutlinedTextField(
                    value = everyNDays,
                    onValueChange = { everyNDays = it.filter { c -> c.isDigit() } },
                    label = { Text(text = stringResource(id = R.string.medication_every_n_days_label)) },
                    singleLine = true
                )
                TextButton(onClick = { isActive = !isActive }) {
                    Text(
                        text =
                        if (isActive) {
                            stringResource(id = R.string.medication_active)
                        } else {
                            stringResource(id = R.string.medication_inactive)
                        }
                    )
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    if (name.isNotBlank()) {
                        onConfirm(
                            MedicationPlanUpdateDto(
                                name = name.trim(),
                                instructions = instructions.trim(),
                                startDate = startDate.trim().ifBlank { plan.startDate },
                                scheduleTime =
                                scheduleTime.trim().ifBlank {
                                    plan.scheduleTime.take(SCHEDULE_TIME_DISPLAY_LENGTH)
                                },
                                everyNDays = everyNDays.toIntOrNull() ?: plan.everyNDays,
                                isActive = isActive
                            )
                        )
                    }
                },
                enabled = name.isNotBlank()
            ) {
                Text(text = stringResource(id = R.string.action_save))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(text = stringResource(id = R.string.action_cancel))
            }
        }
    )
}

@Composable
@Suppress("LongMethod")
private fun CreateMedicationPlanDialog(onConfirm: (MedicationPlanInputDto) -> Unit, onDismiss: () -> Unit) {
    var name by remember { mutableStateOf("") }
    var instructions by remember { mutableStateOf("") }
    var scheduleTime by remember { mutableStateOf("08:00") }
    var everyNDays by remember { mutableStateOf("1") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(text = stringResource(id = R.string.medication_create_title)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text(text = stringResource(id = R.string.medication_name_label)) },
                    singleLine = true
                )
                OutlinedTextField(
                    value = instructions,
                    onValueChange = { instructions = it },
                    label = { Text(text = stringResource(id = R.string.medication_instructions_label)) },
                    singleLine = true
                )
                OutlinedTextField(
                    value = scheduleTime,
                    onValueChange = { scheduleTime = it },
                    label = { Text(text = stringResource(id = R.string.medication_time_label)) },
                    singleLine = true
                )
                OutlinedTextField(
                    value = everyNDays,
                    onValueChange = { everyNDays = it.filter { c -> c.isDigit() } },
                    label = { Text(text = stringResource(id = R.string.medication_every_n_days_label)) },
                    singleLine = true
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    if (name.isNotBlank()) {
                        onConfirm(
                            MedicationPlanInputDto(
                                name = name.trim(),
                                instructions = instructions.trim(),
                                startDate = LocalDate.now().toString(),
                                scheduleTime = scheduleTime.trim().ifBlank { "08:00" },
                                everyNDays = everyNDays.toIntOrNull() ?: 1
                            )
                        )
                    }
                },
                enabled = name.isNotBlank()
            ) {
                Text(text = stringResource(id = R.string.action_add))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(text = stringResource(id = R.string.action_cancel))
            }
        }
    )
}
