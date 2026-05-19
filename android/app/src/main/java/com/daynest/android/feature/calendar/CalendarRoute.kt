@file:Suppress("ktlint:standard:function-naming", "FunctionNaming")

package com.daynest.android.feature.calendar

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.daynest.android.R
import com.daynest.android.app.navigation.DaynestDestination
import com.daynest.android.app.navigation.DaynestNavigationScaffold
import com.daynest.android.data.calendar.CalendarDaySummaryDto
import com.daynest.android.data.calendar.UnifiedDayItemDto
import com.daynest.android.data.today.PlannedItemCreateDto
import com.daynest.android.data.today.PlannedItemUpdateDto
import java.time.LocalDate
import java.time.format.TextStyle
import java.time.temporal.WeekFields
import java.util.Locale

private const val DAYS_IN_WEEK = 7

@Composable
fun CalendarRoute(
    onNavigate: (String) -> Unit = {},
    viewModel: CalendarViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    CalendarScreen(
        uiState = uiState,
        onEvent = viewModel::onEvent,
        onNavigate = onNavigate,
    )
}

@Composable
private fun CalendarScreen(
    uiState: CalendarUiState,
    onEvent: (CalendarUiEvent) -> Unit,
    onNavigate: (String) -> Unit,
) {
    DaynestNavigationScaffold(
        currentRoute = DaynestDestination.CALENDAR,
        onNavigate = onNavigate,
    ) { innerPadding ->
        when (val state = uiState) {
            CalendarUiState.Loading -> {
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

            is CalendarUiState.Error -> {
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
                        text = stringResource(id = R.string.calendar_error),
                        style = MaterialTheme.typography.bodyLarge,
                    )
                    Button(
                        onClick = { onEvent(CalendarUiEvent.RetryClicked) },
                        modifier = Modifier.padding(top = 16.dp),
                    ) {
                        Text(text = stringResource(id = R.string.home_retry))
                    }
                }
            }

            is CalendarUiState.Content -> {
                CalendarContent(
                    state = state,
                    onEvent = onEvent,
                    modifier = Modifier.padding(innerPadding),
                )
            }
        }
    }
}

@Composable
@Suppress("LongMethod", "CyclomaticComplexMethod")
private fun CalendarContent(
    state: CalendarUiState.Content,
    onEvent: (CalendarUiEvent) -> Unit,
    modifier: Modifier = Modifier,
) {
    var showAddDialog by remember(state.selectedDate) { mutableStateOf(false) }
    var editingItem by remember(state.selectedDate) { mutableStateOf<UnifiedDayItemDto?>(null) }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        item {
            MonthHeader(
                displayMonth = state.displayMonth,
                onPrevious = { onEvent(CalendarUiEvent.PreviousMonthClicked) },
                onNext = { onEvent(CalendarUiEvent.NextMonthClicked) },
            )
        }

        item {
            MonthGrid(
                displayMonth = state.displayMonth,
                days = state.days,
                selectedDate = state.selectedDate,
                onDayClick = { date ->
                    if (state.selectedDate == date) {
                        onEvent(CalendarUiEvent.DayDeselected)
                    } else {
                        onEvent(CalendarUiEvent.DaySelected(date))
                    }
                },
            )
        }

        if (state.selectedDate != null) {
            item {
                Spacer(modifier = Modifier.height(8.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = stringResource(id = R.string.calendar_day_detail_header, state.selectedDate),
                        style = MaterialTheme.typography.titleMedium,
                        modifier = Modifier.weight(1f),
                    )
                    TextButton(onClick = { showAddDialog = true }) {
                        Text(text = stringResource(id = R.string.calendar_add_planned))
                    }
                }
            }

            if (state.isLoadingDay) {
                item {
                    Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(modifier = Modifier.size(24.dp))
                    }
                }
            } else if (state.dayItems.isEmpty()) {
                item {
                    Text(
                        text = stringResource(id = R.string.calendar_day_empty),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.outline,
                    )
                }
            } else {
                itemsIndexed(
                    state.dayItems,
                    key = { index, item ->
                        "${item.itemType}_${item.itemId}_${item.scheduledAt ?: item.scheduledDate.orEmpty()}_$index"
                    },
                ) { _, item ->
                    DayItemCard(
                        item = item,
                        onEdit =
                            if (item.itemType == "planned") {
                                { editingItem = item }
                            } else {
                                null
                            },
                        onDelete =
                            if (item.itemType == "planned") {
                                { onEvent(CalendarUiEvent.DeletePlannedItem(item.itemId, state.selectedDate)) }
                            } else {
                                null
                            },
                    )
                }
            }
        }
    }

    if (showAddDialog && state.selectedDate != null) {
        AddPlannedItemDialog(
            selectedDate = state.selectedDate,
            onConfirm = { input ->
                onEvent(CalendarUiEvent.AddPlannedItem(input))
                showAddDialog = false
            },
            onDismiss = { showAddDialog = false },
        )
    }

    val currentEditingItem = editingItem
    if (currentEditingItem != null && state.selectedDate != null) {
        EditPlannedItemDialog(
            item = currentEditingItem,
            onConfirm = { input ->
                onEvent(CalendarUiEvent.UpdatePlannedItem(currentEditingItem.itemId, state.selectedDate, input))
                editingItem = null
            },
            onDismiss = { editingItem = null },
        )
    }
}

@Composable
private fun MonthHeader(
    displayMonth: LocalDate,
    onPrevious: () -> Unit,
    onNext: () -> Unit,
) {
    val monthName =
        remember(displayMonth) {
            displayMonth.month.getDisplayName(TextStyle.FULL, Locale.getDefault())
        }
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        TextButton(onClick = onPrevious) {
            Text(text = stringResource(id = R.string.calendar_prev_month))
        }
        Text(
            text =
                stringResource(
                    id = R.string.calendar_month_year,
                    monthName,
                    displayMonth.year.toString(),
                ),
            style = MaterialTheme.typography.titleLarge,
        )
        TextButton(onClick = onNext) {
            Text(text = stringResource(id = R.string.calendar_next_month))
        }
    }
}

@Composable
@Suppress("LongMethod")
private fun MonthGrid(
    displayMonth: LocalDate,
    days: List<CalendarDaySummaryDto>,
    selectedDate: String?,
    onDayClick: (String) -> Unit,
) {
    val today = remember { LocalDate.now().toString() }
    val dayMap = remember(days) { days.associateBy { it.date } }
    val firstDayOfMonth = remember(displayMonth) { displayMonth.withDayOfMonth(1) }
    val daysInMonth = remember(displayMonth) { displayMonth.lengthOfMonth() }
    val firstDayOfWeek = remember { WeekFields.of(Locale.getDefault()).firstDayOfWeek }
    val firstWeekday =
        remember(firstDayOfMonth, firstDayOfWeek) {
            Math.floorMod(firstDayOfMonth.dayOfWeek.value - firstDayOfWeek.value, DAYS_IN_WEEK)
        }
    val dayLabels =
        remember(firstDayOfWeek) {
            (0 until DAYS_IN_WEEK).map { offset ->
                firstDayOfWeek.plus(offset.toLong()).getDisplayName(TextStyle.SHORT, Locale.getDefault())
            }
        }

    Column {
        Row(modifier = Modifier.fillMaxWidth()) {
            dayLabels.forEach { label ->
                Text(
                    text = label,
                    modifier = Modifier.weight(1f),
                    textAlign = TextAlign.Center,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.outline,
                )
            }
        }
        Spacer(modifier = Modifier.height(4.dp))

        val totalCells = firstWeekday + daysInMonth
        val rows = (totalCells + DAYS_IN_WEEK - 1) / DAYS_IN_WEEK
        for (row in 0 until rows) {
            Row(modifier = Modifier.fillMaxWidth()) {
                for (col in 0 until DAYS_IN_WEEK) {
                    val cellIndex = row * DAYS_IN_WEEK + col
                    val dayNum = cellIndex - firstWeekday + 1
                    if (dayNum < 1 || dayNum > daysInMonth) {
                        Spacer(modifier = Modifier.weight(1f).aspectRatio(1f))
                    } else {
                        val date = displayMonth.withDayOfMonth(dayNum).toString()
                        val summary = dayMap[date]
                        val isSelected = date == selectedDate
                        val isToday = date == today
                        DayCell(
                            dayNum = dayNum,
                            routines = summary?.routines ?: 0,
                            chores = summary?.chores ?: 0,
                            medications = summary?.medications ?: 0,
                            planned = summary?.planned ?: 0,
                            isSelected = isSelected,
                            isToday = isToday,
                            onClick = { onDayClick(date) },
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun DayCell(
    dayNum: Int,
    routines: Int,
    chores: Int,
    medications: Int,
    planned: Int,
    isSelected: Boolean,
    isToday: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val bgColor =
        when {
            isSelected -> MaterialTheme.colorScheme.primary
            isToday -> MaterialTheme.colorScheme.primaryContainer
            else -> androidx.compose.ui.graphics.Color.Transparent
        }
    val textColor =
        when {
            isSelected -> MaterialTheme.colorScheme.onPrimary
            isToday -> MaterialTheme.colorScheme.onPrimaryContainer
            else -> MaterialTheme.colorScheme.onSurface
        }

    val dotColors =
        remember(isSelected, routines, chores, medications, planned) {
            buildList {
                if (routines > 0) add(0)
                if (chores > 0) add(1)
                if (medications > 0) add(2)
                if (planned > 0) add(3)
            }
        }

    Box(
        modifier =
            modifier
                .aspectRatio(1f)
                .padding(2.dp)
                .clip(CircleShape)
                .background(bgColor)
                .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = dayNum.toString(),
                style = MaterialTheme.typography.bodySmall,
                color = textColor,
            )
            if (dotColors.isNotEmpty()) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(2.dp),
                ) {
                    dotColors.forEach { typeIndex ->
                        val dotColor =
                            if (isSelected) {
                                MaterialTheme.colorScheme.onPrimary
                            } else {
                                when (typeIndex) {
                                    0 -> MaterialTheme.colorScheme.primary
                                    1 -> MaterialTheme.colorScheme.secondary
                                    2 -> MaterialTheme.colorScheme.tertiary
                                    else -> MaterialTheme.colorScheme.outline
                                }
                            }
                        Box(
                            modifier =
                                Modifier
                                    .size(3.dp)
                                    .clip(CircleShape)
                                    .background(dotColor),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun DayItemCard(
    item: UnifiedDayItemDto,
    onEdit: (() -> Unit)?,
    onDelete: (() -> Unit)?,
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
                Text(text = item.title, style = MaterialTheme.typography.bodyMedium)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = item.itemType,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.primary,
                    )
                    if (item.status.isNotEmpty()) {
                        Text(
                            text = item.status,
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.outline,
                        )
                    }
                }
                if (!item.detail.isNullOrBlank()) {
                    Text(
                        text = item.detail,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.outline,
                    )
                }
            }
            if (onEdit != null) {
                TextButton(onClick = onEdit) {
                    Text(text = stringResource(id = R.string.action_edit))
                }
            }
            if (onDelete != null) {
                TextButton(onClick = onDelete) {
                    Text(
                        text = stringResource(id = R.string.action_delete),
                        color = MaterialTheme.colorScheme.error,
                    )
                }
            }
        }
    }
}

@Composable
private fun EditPlannedItemDialog(
    item: UnifiedDayItemDto,
    onConfirm: (PlannedItemUpdateDto) -> Unit,
    onDismiss: () -> Unit,
) {
    var title by remember(item.itemId) { mutableStateOf(item.title) }
    var plannedFor by remember(item.itemId) { mutableStateOf(item.scheduledDate.orEmpty()) }
    var notes by remember(item.itemId) { mutableStateOf(item.detail.orEmpty()) }
    var moduleKey by remember(item.itemId) { mutableStateOf(item.moduleKey.orEmpty()) }
    var recurrenceHint by remember(item.itemId) { mutableStateOf(item.recurrenceHint.orEmpty()) }
    var linkedSource by remember(item.itemId) { mutableStateOf(item.linkedSource.orEmpty()) }
    var linkedRef by remember(item.itemId) { mutableStateOf(item.linkedRef.orEmpty()) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(text = stringResource(id = R.string.calendar_edit_planned_title)) },
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
                        PlannedItemUpdateDto(
                            title = title.trim(),
                            plannedFor = plannedFor.trim(),
                            isDone = item.status == "done",
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

@Composable
private fun AddPlannedItemDialog(
    selectedDate: String,
    onConfirm: (PlannedItemCreateDto) -> Unit,
    onDismiss: () -> Unit,
) {
    var title by remember { mutableStateOf("") }
    var plannedFor by remember(selectedDate) { mutableStateOf(selectedDate) }
    var notes by remember { mutableStateOf("") }
    var moduleKey by remember { mutableStateOf("") }
    var recurrenceHint by remember { mutableStateOf("") }
    var linkedSource by remember { mutableStateOf("") }
    var linkedRef by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(text = stringResource(id = R.string.calendar_add_planned_title)) },
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
                        PlannedItemCreateDto(
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
