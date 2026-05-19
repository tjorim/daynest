@file:Suppress("ktlint:standard:function-naming", "FunctionNaming")

package com.daynest.android.feature.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
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
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.daynest.android.R
import com.daynest.android.app.navigation.DaynestDestination
import com.daynest.android.app.navigation.DaynestNavigationScaffold
import com.daynest.android.data.today.MedicationTodayItemDto
import com.daynest.android.data.today.PlannedTodayItemDto
import com.daynest.android.data.today.RoutineTodayItemDto
import com.daynest.android.data.today.UpcomingTodayItemDto

@Composable
@Suppress("FunctionNaming")
fun HomeRoute(
    onNavigate: (String) -> Unit = {},
    viewModel: HomeViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    HomeScreen(
        uiState = uiState,
        onEvent = viewModel::onEvent,
        onNavigate = onNavigate,
    )
}

@Composable
@Suppress("FunctionNaming", "LongMethod", "CyclomaticComplexMethod")
internal fun HomeScreen(
    uiState: HomeUiState,
    onEvent: (HomeUiEvent) -> Unit,
    onNavigate: (String) -> Unit = {},
) {
    DaynestNavigationScaffold(
        currentRoute = DaynestDestination.HOME,
        onNavigate = onNavigate,
    ) { innerPadding ->
        when (val state = uiState) {
            HomeUiState.Loading -> {
                Column(
                    modifier =
                        Modifier
                            .fillMaxSize()
                            .padding(innerPadding),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                ) {
                    CircularProgressIndicator()
                }
            }

            is HomeUiState.Content -> {
                TodayContent(
                    state = state,
                    onEvent = onEvent,
                    modifier = Modifier.padding(innerPadding),
                )
            }

            is HomeUiState.Error -> {
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
                        text = stringResource(id = R.string.home_error_generic),
                        style = MaterialTheme.typography.bodyLarge,
                    )
                    Button(
                        onClick = { onEvent(HomeUiEvent.RetryClicked) },
                        modifier = Modifier.padding(top = 20.dp),
                    ) {
                        Text(text = stringResource(id = R.string.home_retry))
                    }
                }
            }
        }
    }
}

@Composable
@Suppress("FunctionNaming", "LongMethod", "CyclomaticComplexMethod")
private fun TodayContent(
    state: HomeUiState.Content,
    onEvent: (HomeUiEvent) -> Unit,
    modifier: Modifier = Modifier,
) {
    var rescheduleTarget by remember { mutableStateOf<RescheduleTarget?>(null) }
    var plannedEditTarget by remember { mutableStateOf<PlannedTodayItemDto?>(null) }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Column {
                Text(
                    text = stringResource(id = R.string.home_welcome),
                    style = MaterialTheme.typography.headlineMedium,
                )
                if (state.isStale) {
                    Text(
                        text = stringResource(id = R.string.home_stale_notice),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.outline,
                    )
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text =
                        if (state.summary.isCaughtUp) {
                            stringResource(id = R.string.home_all_caught_up)
                        } else {
                            pluralStringResource(
                                id = R.plurals.home_items_remaining,
                                count = state.summary.remainingCount,
                                state.summary.remainingCount,
                            )
                        },
                    style = MaterialTheme.typography.bodyLarge,
                )
            }
        }

        item {
            TodaySummaryStrip(state = state)
        }

        if (state.medication.isNotEmpty()) {
            item {
                SectionHeader(title = stringResource(id = R.string.today_section_medication))
            }
            items(state.medication, key = { "med_${it.medicationDoseInstanceId}" }) { item ->
                MedicationTodayCard(
                    item = item,
                    onTake = { onEvent(HomeUiEvent.TakeMedicationClicked(item.medicationDoseInstanceId)) },
                    onSkip = { onEvent(HomeUiEvent.SkipMedicationClicked(item.medicationDoseInstanceId)) },
                )
            }
        }

        if (state.routines.isNotEmpty()) {
            item {
                SectionHeader(title = stringResource(id = R.string.today_section_routines))
            }
            items(state.routines, key = { "routine_${it.taskInstanceId}" }) { item ->
                RoutineCard(
                    item = item,
                    onStart = { onEvent(HomeUiEvent.StartTaskClicked(item.taskInstanceId)) },
                    onComplete = { onEvent(HomeUiEvent.CompleteTaskClicked(item.taskInstanceId)) },
                    onSkip = { onEvent(HomeUiEvent.SkipTaskClicked(item.taskInstanceId)) },
                )
            }
        }

        if (state.overdue.isNotEmpty()) {
            item {
                SectionHeader(
                    title = stringResource(id = R.string.today_section_overdue),
                    titleColor = MaterialTheme.colorScheme.error,
                )
            }
            items(state.overdue, key = { "overdue_${it.choreInstanceId}" }) { item ->
                ChoreCard(
                    title = item.title,
                    subtitle =
                        if (item.overdueSince.isNotEmpty()) {
                            stringResource(id = R.string.today_overdue_since, item.overdueSince)
                        } else {
                            null
                        },
                    onComplete = { onEvent(HomeUiEvent.CompleteChoreClicked(item.choreInstanceId)) },
                    onSkip = { onEvent(HomeUiEvent.SkipChoreClicked(item.choreInstanceId)) },
                    onReschedule = {
                        rescheduleTarget =
                            RescheduleTarget(
                                id = item.choreInstanceId,
                                title = item.title,
                                scheduledDate = item.overdueSince,
                            )
                    },
                )
            }
        }

        if (state.dueToday.isNotEmpty()) {
            item {
                SectionHeader(title = stringResource(id = R.string.today_section_due_today))
            }
            items(state.dueToday, key = { "due_${it.choreInstanceId}" }) { item ->
                ChoreCard(
                    title = item.title,
                    subtitle = null,
                    onComplete = { onEvent(HomeUiEvent.CompleteChoreClicked(item.choreInstanceId)) },
                    onSkip = { onEvent(HomeUiEvent.SkipChoreClicked(item.choreInstanceId)) },
                    onReschedule = {
                        rescheduleTarget =
                            RescheduleTarget(
                                id = item.choreInstanceId,
                                title = item.title,
                                scheduledDate = item.scheduledDate,
                            )
                    },
                )
            }
        }

        if (state.planned.isNotEmpty()) {
            item {
                SectionHeader(title = stringResource(id = R.string.today_section_planned))
            }
            items(state.planned, key = { "planned_${it.id}" }) { item ->
                PlannedItemCard(
                    item = item,
                    onToggleDone = { onEvent(HomeUiEvent.MarkPlannedDoneClicked(item.id, !item.isDone)) },
                    onEdit = { plannedEditTarget = item },
                    onDelete = { onEvent(HomeUiEvent.DeletePlannedClicked(item.id)) },
                )
            }
        }

        if (state.upcoming.isNotEmpty()) {
            item {
                SectionHeader(title = stringResource(id = R.string.today_section_upcoming))
            }
            items(state.upcoming, key = { "upcoming_${it.choreInstanceId}" }) { item ->
                UpcomingChoreCard(
                    item = item,
                    onReschedule = {
                        rescheduleTarget =
                            RescheduleTarget(
                                id = item.choreInstanceId,
                                title = item.title,
                                scheduledDate = item.scheduledDate,
                            )
                    },
                )
            }
        }

        if (state.medicationHistory.isNotEmpty()) {
            item {
                SectionHeader(title = stringResource(id = R.string.today_section_medication_history))
            }
            itemsIndexed(
                state.medicationHistory,
                key = { index, item -> "medhist_${item.medicationDoseInstanceId}_${item.scheduledAt}_$index" },
            ) { _, item ->
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text(text = item.name, style = MaterialTheme.typography.bodyMedium)
                        Text(
                            text = item.status,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.outline,
                        )
                    }
                }
            }
        }

        if (state.summary.isCaughtUp) {
            item {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = stringResource(id = R.string.home_all_caught_up),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.outline,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
    }

    rescheduleTarget?.let { target ->
        RescheduleChoreDialog(
            target = target,
            onConfirm = { scheduledDate ->
                onEvent(HomeUiEvent.RescheduleChoreClicked(target.id, scheduledDate))
                rescheduleTarget = null
            },
            onDismiss = { rescheduleTarget = null },
        )
    }

    plannedEditTarget?.let { item ->
        PlannedItemDialog(
            titleRes = R.string.calendar_edit_planned_title,
            item = item,
            onConfirm = {
                onEvent(HomeUiEvent.UpdatePlannedClicked(it))
                plannedEditTarget = null
            },
            onDismiss = { plannedEditTarget = null },
        )
    }
}

private data class RescheduleTarget(
    val id: Int,
    val title: String,
    val scheduledDate: String,
)

@Composable
@Suppress("FunctionNaming")
private fun TodaySummaryStrip(state: HomeUiState.Content) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            SummaryMetricCard(
                label = stringResource(id = R.string.today_section_overdue),
                value = state.overdue.size,
                modifier = Modifier.weight(1f),
            )
            SummaryMetricCard(
                label = stringResource(id = R.string.today_section_due_today),
                value = state.dueToday.size,
                modifier = Modifier.weight(1f),
            )
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            SummaryMetricCard(
                label = stringResource(id = R.string.today_section_medication),
                value = state.medication.count { it.status == "scheduled" || it.status == "missed" },
                modifier = Modifier.weight(1f),
            )
            SummaryMetricCard(
                label = stringResource(id = R.string.today_section_planned),
                value = state.planned.count { !it.isDone },
                modifier = Modifier.weight(1f),
            )
            SummaryMetricCard(
                label = stringResource(id = R.string.today_section_routines),
                value = state.routines.count { it.status == "pending" || it.status == "in_progress" },
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
@Suppress("FunctionNaming")
private fun SummaryMetricCard(
    label: String,
    value: Int,
    modifier: Modifier = Modifier,
) {
    Card(modifier = modifier) {
        Column(modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp)) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.primary,
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = value.toString(),
                style = MaterialTheme.typography.headlineSmall,
            )
        }
    }
}

@Composable
private fun SectionHeader(
    title: String,
    titleColor: androidx.compose.ui.graphics.Color = MaterialTheme.colorScheme.onSurface,
) {
    Text(
        text = title,
        style = MaterialTheme.typography.titleSmall,
        color = titleColor,
        modifier = Modifier.padding(top = 4.dp, bottom = 2.dp),
    )
}

@Composable
@Suppress("FunctionNaming")
private fun MedicationTodayCard(
    item: MedicationTodayItemDto,
    onTake: () -> Unit,
    onSkip: () -> Unit,
) {
    val isScheduled = item.status == "scheduled"

    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(text = item.name, style = MaterialTheme.typography.bodyMedium)
                if (item.instructions.isNotEmpty()) {
                    Text(
                        text = item.instructions,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.outline,
                    )
                }
            }
            if (isScheduled) {
                TextButton(onClick = onTake) {
                    Text(text = stringResource(id = R.string.action_take))
                }
                TextButton(onClick = onSkip) {
                    Text(text = stringResource(id = R.string.action_skip))
                }
            } else {
                Text(
                    text = item.status,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.outline,
                )
            }
        }
    }
}

@Composable
@Suppress("FunctionNaming")
private fun RoutineCard(
    item: RoutineTodayItemDto,
    onStart: () -> Unit,
    onComplete: () -> Unit,
    onSkip: () -> Unit,
) {
    val isDone = item.status == "completed"
    val isSkipped = item.status == "skipped"
    val canStart = item.status == "pending"
    val canMutate = !isDone && !isSkipped
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = item.title,
                style = MaterialTheme.typography.bodyMedium,
                textDecoration = if (isDone) TextDecoration.LineThrough else TextDecoration.None,
                modifier = Modifier.weight(1f),
            )
            if (canMutate) {
                if (canStart) {
                    TextButton(onClick = onStart) {
                        Text(text = stringResource(id = R.string.action_start))
                    }
                }
                TextButton(onClick = onComplete) {
                    Text(text = stringResource(id = R.string.action_done))
                }
                TextButton(onClick = onSkip) {
                    Text(text = stringResource(id = R.string.action_skip))
                }
            }
        }
    }
}

@Composable
@Suppress("FunctionNaming")
private fun ChoreCard(
    title: String,
    subtitle: String?,
    onComplete: () -> Unit,
    onSkip: () -> Unit,
    onReschedule: () -> Unit,
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
                Text(text = title, style = MaterialTheme.typography.bodyMedium)
                if (subtitle != null) {
                    Text(
                        text = subtitle,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.outline,
                    )
                }
            }
            TextButton(onClick = onComplete) {
                Text(text = stringResource(id = R.string.action_done))
            }
            TextButton(onClick = onSkip) {
                Text(text = stringResource(id = R.string.action_skip))
            }
            TextButton(onClick = onReschedule) {
                Text(text = stringResource(id = R.string.action_reschedule))
            }
        }
    }
}

@Composable
@Suppress("FunctionNaming")
private fun PlannedItemCard(
    item: PlannedTodayItemDto,
    onToggleDone: () -> Unit,
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
                Text(
                    text = item.title,
                    style = MaterialTheme.typography.bodyMedium,
                    textDecoration = if (item.isDone) TextDecoration.LineThrough else TextDecoration.None,
                )
                if (!item.notes.isNullOrBlank()) {
                    Text(
                        text = item.notes,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.outline,
                    )
                }
                if (!item.moduleKey.isNullOrBlank()) {
                    Text(
                        text = item.moduleKey,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
            }
            TextButton(onClick = onToggleDone) {
                Text(
                    text =
                        if (item.isDone) {
                            stringResource(id = R.string.action_undo)
                        } else {
                            stringResource(id = R.string.action_done)
                        },
                )
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
@Suppress("FunctionNaming")
private fun UpcomingChoreCard(
    item: UpcomingTodayItemDto,
    onReschedule: () -> Unit,
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = item.title,
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.weight(1f),
            )
            if (item.scheduledDate.isNotEmpty()) {
                Text(
                    text = item.scheduledDate,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.outline,
                )
            }
            TextButton(onClick = onReschedule) {
                Text(text = stringResource(id = R.string.action_reschedule))
            }
        }
    }
}

@Composable
private fun RescheduleChoreDialog(
    target: RescheduleTarget,
    onConfirm: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    var scheduledDate by remember(target) { mutableStateOf(target.scheduledDate) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(text = stringResource(id = R.string.calendar_reschedule_chore_title)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(text = target.title, style = MaterialTheme.typography.bodyMedium)
                OutlinedTextField(
                    value = scheduledDate,
                    onValueChange = { scheduledDate = it },
                    label = { Text(text = stringResource(id = R.string.calendar_planned_date_label)) },
                    singleLine = true,
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onConfirm(scheduledDate.trim()) },
                enabled = scheduledDate.isNotBlank(),
            ) {
                Text(text = stringResource(id = R.string.action_save))
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
@Suppress("LongMethod")
private fun PlannedItemDialog(
    titleRes: Int,
    item: PlannedTodayItemDto,
    onConfirm: (PlannedTodayItemDto) -> Unit,
    onDismiss: () -> Unit,
) {
    var title by remember(item) { mutableStateOf(item.title) }
    var plannedFor by remember(item) { mutableStateOf(item.plannedFor) }
    var notes by remember(item) { mutableStateOf(item.notes.orEmpty()) }
    var moduleKey by remember(item) { mutableStateOf(item.moduleKey.orEmpty()) }
    var recurrenceHint by remember(item) { mutableStateOf(item.recurrenceHint.orEmpty()) }
    var linkedSource by remember(item) { mutableStateOf(item.linkedSource.orEmpty()) }
    var linkedRef by remember(item) { mutableStateOf(item.linkedRef.orEmpty()) }

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
                        item.copy(
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
                Text(text = stringResource(id = R.string.action_save))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(text = stringResource(id = R.string.action_cancel))
            }
        },
    )
}
