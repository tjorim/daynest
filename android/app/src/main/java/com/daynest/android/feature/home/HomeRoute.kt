@file:Suppress("ktlint:standard:function-naming", "FunctionNaming", "TooManyFunctions")

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
import androidx.compose.material3.Checkbox
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
import com.daynest.android.feature.home.SectionType

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
            val routineIds = state.routines.map { it.taskInstanceId }
            val allRoutinesSelected = routineIds.isNotEmpty() && state.selectedRoutineIds.containsAll(routineIds)
            item {
                BulkSectionHeader(
                    title = stringResource(id = R.string.today_section_routines),
                    selectedCount = state.selectedRoutineIds.size,
                    allSelected = allRoutinesSelected,
                    onSelectAll = {
                        if (allRoutinesSelected) {
                            onEvent(HomeUiEvent.ClearSelection(SectionType.ROUTINES))
                        } else {
                            onEvent(HomeUiEvent.SelectAll(SectionType.ROUTINES, routineIds))
                        }
                    },
                    onBulkDone = { onEvent(HomeUiEvent.BulkDone(SectionType.ROUTINES)) },
                    onBulkSkip = { onEvent(HomeUiEvent.BulkSkip(SectionType.ROUTINES)) },
                    onBulkUndo = null,
                )
            }
            items(state.routines, key = { "routine_${it.taskInstanceId}" }) { item ->
                RoutineCard(
                    item = item,
                    isSelected = state.selectedRoutineIds.contains(item.taskInstanceId),
                    onToggleSelect = {
                        onEvent(HomeUiEvent.ToggleSelection(SectionType.ROUTINES, item.taskInstanceId))
                    },
                    onStart = { onEvent(HomeUiEvent.StartTaskClicked(item.taskInstanceId)) },
                    onComplete = { onEvent(HomeUiEvent.CompleteTaskClicked(item.taskInstanceId)) },
                    onSkip = { onEvent(HomeUiEvent.SkipTaskClicked(item.taskInstanceId)) },
                )
            }
        }

        if (state.overdue.isNotEmpty()) {
            val overdueIds = state.overdue.map { it.choreInstanceId }
            val dueIds = state.dueToday.map { it.choreInstanceId }
            val allChoreIds = overdueIds + dueIds
            val allChoresSelected = allChoreIds.isNotEmpty() && state.selectedChoreIds.containsAll(allChoreIds)
            item {
                BulkSectionHeader(
                    title = stringResource(id = R.string.today_section_overdue),
                    titleColor = MaterialTheme.colorScheme.error,
                    selectedCount = state.selectedChoreIds.count { it in overdueIds },
                    allSelected = overdueIds.isNotEmpty() && state.selectedChoreIds.containsAll(overdueIds),
                    onSelectAll = {
                        if (state.selectedChoreIds.containsAll(overdueIds)) {
                            onEvent(HomeUiEvent.ClearSelection(SectionType.CHORES))
                        } else {
                            onEvent(HomeUiEvent.SelectAll(SectionType.CHORES, allChoreIds))
                        }
                    },
                    onBulkDone = { onEvent(HomeUiEvent.BulkDone(SectionType.CHORES)) },
                    onBulkSkip = { onEvent(HomeUiEvent.BulkSkip(SectionType.CHORES)) },
                    onBulkUndo = null,
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
                    isSelected = state.selectedChoreIds.contains(item.choreInstanceId),
                    onToggleSelect = { onEvent(HomeUiEvent.ToggleSelection(SectionType.CHORES, item.choreInstanceId)) },
                    onComplete = { onEvent(HomeUiEvent.CompleteChoreClicked(item.choreInstanceId)) },
                    onSkip = { onEvent(HomeUiEvent.SkipChoreClicked(item.choreInstanceId)) },
                    onSnooze = { onEvent(HomeUiEvent.SnoozeChoreClicked(item.choreInstanceId)) },
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
            val dueTodayIds = state.dueToday.map { it.choreInstanceId }
            val overdueIdsForDue = state.overdue.map { it.choreInstanceId }
            val allChoreIdsForDue = overdueIdsForDue + dueTodayIds
            item {
                BulkSectionHeader(
                    title = stringResource(id = R.string.today_section_due_today),
                    selectedCount = state.selectedChoreIds.count { it in dueTodayIds },
                    allSelected = dueTodayIds.isNotEmpty() && state.selectedChoreIds.containsAll(dueTodayIds),
                    onSelectAll = {
                        if (state.selectedChoreIds.containsAll(dueTodayIds)) {
                            onEvent(HomeUiEvent.ClearSelection(SectionType.CHORES))
                        } else {
                            onEvent(HomeUiEvent.SelectAll(SectionType.CHORES, allChoreIdsForDue))
                        }
                    },
                    onBulkDone = { onEvent(HomeUiEvent.BulkDone(SectionType.CHORES)) },
                    onBulkSkip = { onEvent(HomeUiEvent.BulkSkip(SectionType.CHORES)) },
                    onBulkUndo = null,
                )
            }
            items(state.dueToday, key = { "due_${it.choreInstanceId}" }) { item ->
                ChoreCard(
                    title = item.title,
                    subtitle = null,
                    isSelected = state.selectedChoreIds.contains(item.choreInstanceId),
                    onToggleSelect = { onEvent(HomeUiEvent.ToggleSelection(SectionType.CHORES, item.choreInstanceId)) },
                    onComplete = { onEvent(HomeUiEvent.CompleteChoreClicked(item.choreInstanceId)) },
                    onSkip = { onEvent(HomeUiEvent.SkipChoreClicked(item.choreInstanceId)) },
                    onSnooze = { onEvent(HomeUiEvent.SnoozeChoreClicked(item.choreInstanceId)) },
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
            val plannedIds = state.planned.map { it.id }
            val allPlannedSelected = plannedIds.isNotEmpty() && state.selectedPlannedIds.containsAll(plannedIds)
            item {
                BulkSectionHeader(
                    title = stringResource(id = R.string.today_section_planned),
                    selectedCount = state.selectedPlannedIds.size,
                    allSelected = allPlannedSelected,
                    onSelectAll = {
                        if (allPlannedSelected) {
                            onEvent(HomeUiEvent.ClearSelection(SectionType.PLANNED))
                        } else {
                            onEvent(HomeUiEvent.SelectAll(SectionType.PLANNED, plannedIds))
                        }
                    },
                    onBulkDone = { onEvent(HomeUiEvent.BulkDone(SectionType.PLANNED)) },
                    onBulkSkip = null,
                    onBulkUndo = { onEvent(HomeUiEvent.BulkUndo(SectionType.PLANNED)) },
                )
            }
            items(state.planned, key = { "planned_${it.id}" }) { item ->
                PlannedItemCard(
                    item = item,
                    isSelected = state.selectedPlannedIds.contains(item.id),
                    onToggleSelect = { onEvent(HomeUiEvent.ToggleSelection(SectionType.PLANNED, item.id)) },
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
    val completedRoutines = state.routines.count { it.status == "completed" || it.status == "skipped" }
    val completedMedication = state.medication.count { it.status != "scheduled" }
    val completedPlanned = state.planned.count { it.isDone }
    val totalItems = state.routines.size + state.medication.size + state.planned.size +
        state.overdue.size + state.dueToday.size
    val completedItems = completedRoutines + completedMedication + completedPlanned
    val completionPct = if (totalItems == 0) 100 else (completedItems * 100 / totalItems)

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
            SummaryMetricCard(
                label = stringResource(id = R.string.home_completion_ratio),
                value = completionPct,
                valueSuffix = "%",
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
    valueSuffix: String = "",
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
                text = "$value$valueSuffix",
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
private fun BulkSectionHeader(
    title: String,
    selectedCount: Int,
    allSelected: Boolean,
    onSelectAll: () -> Unit,
    onBulkDone: (() -> Unit)?,
    onBulkSkip: (() -> Unit)?,
    onBulkUndo: (() -> Unit)?,
    titleColor: androidx.compose.ui.graphics.Color = MaterialTheme.colorScheme.onSurface,
) {
    Column(modifier = Modifier.padding(top = 4.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Checkbox(checked = allSelected, onCheckedChange = { onSelectAll() })
            Text(
                text = title,
                style = MaterialTheme.typography.titleSmall,
                color = titleColor,
                modifier = Modifier.weight(1f),
            )
        }
        if (selectedCount > 0) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End,
            ) {
                if (onBulkDone != null) {
                    TextButton(onClick = onBulkDone) {
                        Text(text = stringResource(id = R.string.action_done))
                    }
                }
                if (onBulkSkip != null) {
                    TextButton(onClick = onBulkSkip) {
                        Text(text = stringResource(id = R.string.action_skip))
                    }
                }
                if (onBulkUndo != null) {
                    TextButton(onClick = onBulkUndo) {
                        Text(text = stringResource(id = R.string.action_undo))
                    }
                }
            }
        }
    }
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
    isSelected: Boolean,
    onToggleSelect: () -> Unit,
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
            Checkbox(checked = isSelected, onCheckedChange = { onToggleSelect() })
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
    isSelected: Boolean,
    onToggleSelect: () -> Unit,
    onComplete: () -> Unit,
    onSkip: () -> Unit,
    onReschedule: () -> Unit,
    onSnooze: () -> Unit,
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Checkbox(checked = isSelected, onCheckedChange = { onToggleSelect() })
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
            TextButton(onClick = onSnooze) {
                Text(text = stringResource(id = R.string.action_snooze))
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
    isSelected: Boolean,
    onToggleSelect: () -> Unit,
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
            Checkbox(checked = isSelected, onCheckedChange = { onToggleSelect() })
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
