@file:Suppress("ktlint:standard:function-naming", "FunctionNaming")

package com.daynest.android.feature.mealplan

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.daynest.android.R
import com.daynest.android.app.navigation.DaynestDestination
import com.daynest.android.app.navigation.DaynestNavigationScaffold
import com.daynest.android.data.mealplan.MealSlotDto
import com.daynest.android.data.mealplan.WeekDayDto
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle

@Composable
fun MealPlannerRoute(onNavigate: (String) -> Unit = {}, viewModel: MealPlannerViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(viewModel) {
        viewModel.effects.collect { snackbarHostState.showSnackbar(it) }
    }

    MealPlannerScreen(
        uiState = uiState,
        onNavigate = onNavigate,
        onPreviousWeek = viewModel::previousWeek,
        onNextWeek = viewModel::nextWeek,
        onRefresh = viewModel::loadWeek,
        onEditSlot = viewModel::editSlot,
        onDismissEditor = viewModel::dismissEditor,
        onDraftChange = viewModel::updateDraft,
        onSaveSlot = viewModel::saveSlot,
        onGenerateShoppingList = viewModel::generateShoppingList,
        snackbarHostState = snackbarHostState
    )
}

@Composable
internal fun MealPlannerScreen(
    uiState: MealPlannerUiState,
    onNavigate: (String) -> Unit,
    onPreviousWeek: () -> Unit,
    onNextWeek: () -> Unit,
    onRefresh: () -> Unit,
    onEditSlot: (MealSlotDto) -> Unit,
    onDismissEditor: () -> Unit,
    onDraftChange: (MealSlotDraft) -> Unit,
    onSaveSlot: () -> Unit,
    onGenerateShoppingList: () -> Unit,
    snackbarHostState: SnackbarHostState
) {
    DaynestNavigationScaffold(
        currentRoute = DaynestDestination.MEAL_PLAN,
        onNavigate = onNavigate,
        snackbarHostState = snackbarHostState,
        floatingActionButton = {
            FloatingActionButton(onClick = onGenerateShoppingList) {
                Text(text = stringResource(id = R.string.meal_plan_generate_shopping_list_short))
            }
        }
    ) { innerPadding ->
        MealPlannerContent(
            uiState = uiState,
            onPreviousWeek = onPreviousWeek,
            onNextWeek = onNextWeek,
            onRefresh = onRefresh,
            onEditSlot = onEditSlot,
            modifier = Modifier.padding(innerPadding)
        )
    }

    if (uiState.editingSlot != null) {
        MealSlotBottomSheet(
            draft = uiState.draft,
            onDraftChange = onDraftChange,
            onDismiss = onDismissEditor,
            onSave = onSaveSlot
        )
    }
}

@Composable
private fun MealPlannerContent(
    uiState: MealPlannerUiState,
    onPreviousWeek: () -> Unit,
    onNextWeek: () -> Unit,
    onRefresh: () -> Unit,
    onEditSlot: (MealSlotDto) -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(text = stringResource(id = R.string.meal_plan_title), style = MaterialTheme.typography.headlineSmall)
        Text(text = stringResource(id = R.string.meal_plan_subtitle), style = MaterialTheme.typography.bodyMedium)
        WeekNavigation(
            weekStart = uiState.weekStart,
            onPreviousWeek = onPreviousWeek,
            onNextWeek = onNextWeek
        )
        uiState.error?.let { error ->
            Text(text = error, color = MaterialTheme.colorScheme.error)
            TextButton(onClick = onRefresh) { Text(text = stringResource(id = R.string.action_refresh)) }
        }
        if (uiState.isLoading) {
            Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        }
        uiState.weekGrid?.let { week ->
            val slots = remember(week.days) { mealGridSlots(week.days) }
            MealWeekGrid(
                days = slots,
                onEditSlot = onEditSlot
            )
        }
    }
}

@Composable
private fun WeekNavigation(weekStart: LocalDate, onPreviousWeek: () -> Unit, onNextWeek: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        val prevLabel = stringResource(R.string.meal_plan_previous_week)
        val nextLabel = stringResource(R.string.meal_plan_next_week)
        TextButton(
            onClick = onPreviousWeek,
            modifier = Modifier.semantics { contentDescription = prevLabel }
        ) { Text(text = "‹") }
        Text(
            text =
            stringResource(
                id = R.string.meal_plan_week_range,
                weekStart.format(DateTimeFormatter.ISO_DATE),
                weekStart.plusDays(WEEK_END_DAY_OFFSET).format(DateTimeFormatter.ISO_DATE)
            ),
            fontWeight = FontWeight.Bold
        )
        TextButton(
            onClick = onNextWeek,
            modifier = Modifier.semantics { contentDescription = nextLabel }
        ) { Text(text = "›") }
    }
}

@Composable
private fun MealWeekGrid(days: List<MealSlotDto>, onEditSlot: (MealSlotDto) -> Unit) {
    LazyVerticalGrid(
        columns = GridCells.Fixed(DAYS_PER_WEEK),
        contentPadding = PaddingValues(bottom = 88.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        items(days, key = { it.id }) { slot ->
            MealSlotCard(slot = slot, onEditSlot = onEditSlot)
        }
    }
}

@Composable
private fun MealSlotCard(slot: MealSlotDto, onEditSlot: (MealSlotDto) -> Unit) {
    val date = remember(slot.slotDate) { LocalDate.parse(slot.slotDate) }
    val locale = LocalConfiguration.current.locales[0]
    val slotTypeLabel =
        when (slot.slotType.lowercase()) {
            "breakfast" -> stringResource(id = R.string.meal_slot_breakfast)
            "lunch" -> stringResource(id = R.string.meal_slot_lunch)
            "dinner" -> stringResource(id = R.string.meal_slot_dinner)
            "snack" -> stringResource(id = R.string.meal_slot_snack)
            else -> slot.slotType.replaceFirstChar { it.uppercase() }
        }
    Card(
        modifier =
        Modifier
            .fillMaxWidth()
            .height(132.dp)
            .clickable { onEditSlot(slot) }
    ) {
        Column(
            modifier = Modifier.padding(8.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(
                text = date.dayOfWeek.getDisplayName(TextStyle.SHORT, locale),
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Bold
            )
            Text(text = slotTypeLabel, style = MaterialTheme.typography.labelSmall)
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = slot.title.ifBlank { stringResource(id = R.string.meal_plan_empty_slot) },
                style = MaterialTheme.typography.bodySmall,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )
            if (slot.ingredients.isNotEmpty()) {
                Text(
                    text = stringResource(id = R.string.meal_plan_ingredient_count, slot.ingredients.size),
                    style = MaterialTheme.typography.labelSmall
                )
            }
        }
    }
}

private const val DAYS_PER_WEEK = 7
private const val WEEK_END_DAY_OFFSET = 6L

private fun mealGridSlots(days: List<WeekDayDto>): List<MealSlotDto> =
    listOf("breakfast", "lunch", "dinner", "snack").flatMap { slotType ->
        days.mapNotNull { day -> day.slots[slotType] }
    }
