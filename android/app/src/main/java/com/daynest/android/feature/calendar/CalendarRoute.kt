@file:Suppress("ktlint:standard:function-naming", "FunctionNaming")

package com.daynest.android.feature.calendar

private const val DAYS_IN_WEEK = 7

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
import androidx.compose.foundation.lazy.items
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
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.daynest.android.R
import com.daynest.android.app.navigation.DaynestDestination
import com.daynest.android.app.navigation.DaynestNavigationScaffold
import com.daynest.android.data.calendar.CalendarDaySummaryDto
import com.daynest.android.data.calendar.UnifiedDayItemDto
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.format.TextStyle
import java.util.Locale

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
                items(state.dayItems, key = { "${it.itemType}_${it.itemId}" }) { item ->
                    DayItemCard(
                        item = item,
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
            onConfirm = { title ->
                onEvent(CalendarUiEvent.AddPlannedItem(title, state.selectedDate))
                showAddDialog = false
            },
            onDismiss = { showAddDialog = false },
        )
    }
}

@Composable
private fun MonthHeader(
    displayMonth: LocalDate,
    onPrevious: () -> Unit,
    onNext: () -> Unit,
) {
    val monthName = remember(displayMonth) {
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
            text = stringResource(
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
    val firstWeekday = remember(firstDayOfMonth) { firstDayOfMonth.dayOfWeek.value % DAYS_IN_WEEK }
    val dayLabels = remember {
        (0 until DAYS_IN_WEEK).map { offset ->
            val dayValue = (DayOfWeek.SUNDAY.value - 1 + offset) % DAYS_IN_WEEK + 1
            DayOfWeek.of(dayValue).getDisplayName(TextStyle.SHORT, Locale.getDefault())
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
                            total = summary?.total ?: 0,
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
    total: Int,
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
            if (total > 0) {
                Box(
                    modifier =
                        Modifier
                            .size(4.dp)
                            .clip(CircleShape)
                            .background(
                                if (isSelected) {
                                    MaterialTheme.colorScheme.onPrimary
                                } else {
                                    MaterialTheme.colorScheme.primary
                                },
                            ),
                )
            }
        }
    }
}

@Composable
private fun DayItemCard(
    item: UnifiedDayItemDto,
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
private fun AddPlannedItemDialog(
    onConfirm: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    var title by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(text = stringResource(id = R.string.calendar_add_planned_title)) },
        text = {
            OutlinedTextField(
                value = title,
                onValueChange = { title = it },
                label = { Text(text = stringResource(id = R.string.calendar_planned_title_label)) },
                singleLine = true,
            )
        },
        confirmButton = {
            TextButton(
                onClick = { if (title.isNotBlank()) onConfirm(title.trim()) },
                enabled = title.isNotBlank(),
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
