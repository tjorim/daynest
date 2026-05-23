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
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.daynest.android.R
import com.daynest.android.data.templates.ChoreTemplateDto
import com.daynest.android.data.templates.RoutineTemplateDto

@Composable
fun TemplatesList(
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
private fun RoutineTemplateCard(
    routine: RoutineTemplateDto,
    onEdit: () -> Unit,
) {
    TemplateCard(onEdit = onEdit) {
        TemplateCardBody(
            name = routine.name,
            description = routine.description,
            everyNDays = routine.everyNDays,
            isActive = routine.isActive,
        )
    }
}

@Composable
private fun ChoreTemplateCard(
    chore: ChoreTemplateDto,
    onEdit: () -> Unit,
) {
    TemplateCard(onEdit = onEdit) {
        TemplateCardBody(
            name = chore.name,
            description = chore.description,
            everyNDays = chore.everyNDays,
            isActive = chore.isActive,
        )
    }
}

@Composable
private fun TemplateCard(
    onEdit: () -> Unit,
    body: @Composable () -> Unit,
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
                body()
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
fun activeLabel(isActive: Boolean): String =
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
