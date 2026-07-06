@file:Suppress("ktlint:standard:function-naming", "FunctionNaming")

package com.daynest.android.feature.stats

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.daynest.android.R
import com.daynest.android.app.navigation.DaynestDestination
import com.daynest.android.app.navigation.DaynestNavigationScaffold
import com.daynest.android.data.analytics.AnalyticsSummaryDto
import kotlin.math.roundToInt

@Composable
fun StatsRoute(onNavigate: (String) -> Unit = {}, viewModel: StatsViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    StatsScreen(uiState = uiState, onEvent = viewModel::onEvent, onNavigate = onNavigate)
}

@Composable
private fun StatsScreen(uiState: StatsUiState, onEvent: (StatsUiEvent) -> Unit, onNavigate: (String) -> Unit) {
    DaynestNavigationScaffold(
        currentRoute = DaynestDestination.STATS,
        onNavigate = onNavigate
    ) { innerPadding ->
        when (uiState) {
            StatsUiState.Loading -> {
                Box(
                    modifier = Modifier.fillMaxSize().padding(innerPadding),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }

            StatsUiState.Error -> {
                Column(
                    modifier = Modifier.fillMaxSize().padding(innerPadding).padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Text(text = stringResource(id = R.string.stats_load_error))
                    Button(
                        onClick = { onEvent(StatsUiEvent.RetryClicked) },
                        modifier = Modifier.padding(top = 16.dp)
                    ) {
                        Text(text = stringResource(id = R.string.home_retry))
                    }
                }
            }

            is StatsUiState.Content -> {
                StatsContent(state = uiState, onEvent = onEvent, modifier = Modifier.padding(innerPadding))
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun StatsContent(state: StatsUiState.Content, onEvent: (StatsUiEvent) -> Unit, modifier: Modifier = Modifier) {
    val summary = state.summary

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text(text = stringResource(id = R.string.stats_title), style = MaterialTheme.typography.headlineMedium)
        }
        item {
            SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
                StatsPeriod.entries.forEachIndexed { index, period ->
                    SegmentedButton(
                        selected = state.period == period,
                        onClick = { onEvent(StatsUiEvent.PeriodSelected(period)) },
                        shape = SegmentedButtonDefaults.itemShape(index = index, count = StatsPeriod.entries.size)
                    ) {
                        Text(text = stringResource(id = period.labelRes()))
                    }
                }
            }
        }
        completionSection(summary)
        streaksSection(summary)
        mostSkippedSection(summary)
        trendSection(
            titleRes = R.string.stats_chores_daily_header,
            values = summary.chores.dailyCompletions.map { it.completionRate.toFloat() }
        )
        trendSection(
            titleRes = R.string.stats_routines_daily_header,
            values = summary.routines.dailyCompletions.map { it.completionRate.toFloat() }
        )
        trendSection(
            titleRes = R.string.stats_medication_adherence_header,
            values = summary.medications.dailyAdherence.map { it.adherenceRate.toFloat() }
        )
    }
}

private fun StatsPeriod.labelRes(): Int = when (this) {
    StatsPeriod.WEEK -> R.string.stats_period_week
    StatsPeriod.MONTH -> R.string.stats_period_month
    StatsPeriod.YEAR -> R.string.stats_period_year
}

private fun LazyListScope.completionSection(summary: AnalyticsSummaryDto) {
    item {
        Text(text = stringResource(id = R.string.stats_completion_header), style = MaterialTheme.typography.titleMedium)
    }
    item {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            CompletionRow(
                R.string.stats_chores_label,
                summary.chores.completionRate,
                summary.chores.totalCompleted,
                summary.chores.totalScheduled
            )
            CompletionRow(
                R.string.stats_routines_label,
                summary.routines.completionRate,
                summary.routines.totalCompleted,
                summary.routines.totalScheduled
            )
            CompletionRow(
                R.string.stats_medication_label,
                summary.medications.adherenceRate,
                summary.medications.totalTaken,
                summary.medications.totalScheduled
            )
            CompletionRow(
                R.string.stats_planned_items_label,
                summary.plannedItems.completionRate,
                summary.plannedItems.totalCompleted,
                summary.plannedItems.totalScheduled
            )
        }
    }
}

@Composable
private fun CompletionRow(labelRes: Int, rate: Double, completed: Int, total: Int) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(text = stringResource(id = labelRes), style = MaterialTheme.typography.bodyMedium)
            Text(
                text = "${(rate * 100).roundToInt()}% ($completed/$total)",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.outline
            )
        }
    }
}

private fun LazyListScope.streaksSection(summary: AnalyticsSummaryDto) {
    item {
        Text(text = stringResource(id = R.string.stats_streak_header), style = MaterialTheme.typography.titleMedium)
    }
    val choreStreaks = summary.chores.streaks
    val routineStreaks = summary.routines.streaks
    if (choreStreaks.isEmpty() && routineStreaks.isEmpty()) {
        item { Text(text = stringResource(id = R.string.stats_no_streaks), color = MaterialTheme.colorScheme.outline) }
    } else {
        val sortedChoreStreaks = choreStreaks.sortedByDescending { it.currentStreak }
        val sortedRoutineStreaks = routineStreaks.sortedByDescending { it.currentStreak }
        sortedChoreStreaks.forEach { streak ->
            item { StreakCard(streak.name, streak.currentStreak, streak.longestStreak) }
        }
        sortedRoutineStreaks.forEach { streak ->
            item { StreakCard(streak.name, streak.currentStreak, streak.longestStreak) }
        }
    }
}

@Composable
private fun StreakCard(name: String, currentStreak: Int, longestStreak: Int) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(text = name, style = MaterialTheme.typography.bodyMedium)
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    text = stringResource(id = R.string.stats_streak_current, currentStreak),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.outline
                )
                Text(
                    text = stringResource(id = R.string.stats_streak_longest, longestStreak),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.outline
                )
            }
        }
    }
}

private fun LazyListScope.mostSkippedSection(summary: AnalyticsSummaryDto) {
    item {
        Text(
            text = stringResource(id = R.string.stats_most_skipped_header),
            style = MaterialTheme.typography.titleMedium
        )
    }
    val mostSkipped = summary.chores.mostSkipped
    if (mostSkipped.isEmpty()) {
        item { Text(text = stringResource(id = R.string.stats_no_skipped), color = MaterialTheme.colorScheme.outline) }
    } else {
        mostSkipped.forEach { skipped ->
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(text = skipped.name, style = MaterialTheme.typography.bodyMedium)
                        Text(
                            text = stringResource(id = R.string.stats_skip_count, skipped.skipCount),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.outline
                        )
                    }
                }
            }
        }
    }
}

private fun LazyListScope.trendSection(titleRes: Int, values: List<Float>) {
    item {
        Text(text = stringResource(id = titleRes), style = MaterialTheme.typography.titleMedium)
    }
    item {
        DailyTrendChart(values = values, modifier = Modifier.fillMaxWidth().height(120.dp))
    }
}

@Composable
private fun DailyTrendChart(values: List<Float>, modifier: Modifier = Modifier) {
    if (values.size < 2) {
        Box(modifier = modifier, contentAlignment = Alignment.Center) {
            Text(text = stringResource(id = R.string.stats_no_trend_data), color = MaterialTheme.colorScheme.outline)
        }
        return
    }
    val lineColor = MaterialTheme.colorScheme.primary
    Canvas(modifier = modifier) {
        val stepX = size.width / (values.size - 1)
        val path = Path()
        values.forEachIndexed { index, value ->
            val x = index * stepX
            val y = size.height * (1f - value.coerceIn(0f, 1f))
            if (index == 0) path.moveTo(x, y) else path.lineTo(x, y)
        }
        drawPath(path = path, color = lineColor, style = Stroke(width = 4f))
        values.forEachIndexed { index, value ->
            val x = index * stepX
            val y = size.height * (1f - value.coerceIn(0f, 1f))
            drawCircle(color = lineColor, radius = 6f, center = Offset(x, y))
        }
    }
}
