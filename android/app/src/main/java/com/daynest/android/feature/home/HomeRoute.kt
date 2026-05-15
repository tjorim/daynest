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
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
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
                            pluralStringResource(id = R.plurals.home_items_remaining, count = state.summary.remainingCount, state.summary.remainingCount)
                        },
                    style = MaterialTheme.typography.bodyLarge,
                )
            }
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
                    onDelete = { onEvent(HomeUiEvent.DeletePlannedClicked(item.id)) },
                )
            }
        }

        if (state.upcoming.isNotEmpty()) {
            item {
                SectionHeader(title = stringResource(id = R.string.today_section_upcoming))
            }
            items(state.upcoming, key = { "upcoming_${it.choreInstanceId}" }) { item ->
                UpcomingChoreCard(item = item)
            }
        }

        if (state.medicationHistory.isNotEmpty()) {
            item {
                SectionHeader(title = stringResource(id = R.string.today_section_medication_history))
            }
            items(state.medicationHistory, key = { "medhist_${it.medicationDoseInstanceId}" }) { item ->
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
            TextButton(onClick = onTake) {
                Text(text = stringResource(id = R.string.action_take))
            }
            TextButton(onClick = onSkip) {
                Text(text = stringResource(id = R.string.action_skip))
            }
        }
    }
}

@Composable
@Suppress("FunctionNaming")
private fun RoutineCard(
    item: RoutineTodayItemDto,
    onComplete: () -> Unit,
    onSkip: () -> Unit,
) {
    val isDone = item.status == "completed"
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
            if (!isDone) {
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
        }
    }
}

@Composable
@Suppress("FunctionNaming")
private fun PlannedItemCard(
    item: PlannedTodayItemDto,
    onToggleDone: () -> Unit,
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
private fun UpcomingChoreCard(item: UpcomingTodayItemDto) {
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
        }
    }
}
