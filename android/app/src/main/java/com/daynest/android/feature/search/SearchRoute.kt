@file:Suppress("ktlint:standard:function-naming", "FunctionNaming")

package com.daynest.android.feature.search

import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.daynest.android.R
import com.daynest.android.app.navigation.DaynestDestination
import com.daynest.android.data.search.ChoreSearchResultDto
import com.daynest.android.data.search.MedicationSearchResultDto
import com.daynest.android.data.search.PlannedItemSearchResultDto
import com.daynest.android.data.search.RoutineSearchResultDto
import com.daynest.android.data.search.SearchResponseDto

private const val MIN_QUERY_LENGTH = 2

@Composable
fun SearchRoute(onBack: () -> Unit, onNavigate: (String) -> Unit = {}, viewModel: SearchViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val focusRequester = remember { FocusRequester() }

    LaunchedEffect(Unit) {
        focusRequester.requestFocus()
    }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        TextButton(onClick = onBack) { Text(text = stringResource(id = R.string.action_back)) }
        OutlinedTextField(
            value = uiState.query,
            onValueChange = viewModel::onQueryChanged,
            label = { Text(text = stringResource(id = R.string.app_search)) },
            placeholder = { Text(text = stringResource(id = R.string.search_placeholder)) },
            singleLine = true,
            modifier =
            Modifier
                .fillMaxWidth()
                .focusRequester(focusRequester)
                .focusable()
        )
        SearchResultsList(uiState = uiState, onNavigate = onNavigate)
    }
}

@Composable
private fun SearchResultsList(uiState: SearchUiState, onNavigate: (String) -> Unit) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        when {
            uiState.query.trim().length < MIN_QUERY_LENGTH -> {
                item { Text(text = stringResource(id = R.string.search_min_chars)) }
            }
            uiState.isSearching -> {
                item { CircularProgressIndicator() }
            }
            uiState.error != null -> {
                item {
                    Text(text = stringResource(id = R.string.search_error), color = MaterialTheme.colorScheme.error)
                }
            }
            uiState.results != null -> {
                searchResultsSections(uiState.results, onNavigate)
            }
        }
    }
}

private fun LazyListScope.searchResultsSections(results: SearchResponseDto, onNavigate: (String) -> Unit) {
    val isEmpty =
        results.routineTemplates.isEmpty() &&
            results.choreTemplates.isEmpty() &&
            results.medicationPlans.isEmpty() &&
            results.plannedItems.isEmpty()
    if (isEmpty) {
        item { Text(text = stringResource(id = R.string.search_no_results)) }
        return
    }
    if (results.routineTemplates.isNotEmpty()) {
        item {
            SectionHeader(R.string.search_routine_templates)
        }
        results.routineTemplates.forEach { routine ->
            item { RoutineResultCard(routine) { onNavigate(DaynestDestination.TEMPLATES) } }
        }
    }
    if (results.choreTemplates.isNotEmpty()) {
        item {
            SectionHeader(R.string.search_chore_templates)
        }
        results.choreTemplates.forEach { chore ->
            item { ChoreResultCard(chore) { onNavigate(DaynestDestination.TEMPLATES) } }
        }
    }
    if (results.medicationPlans.isNotEmpty()) {
        item {
            SectionHeader(R.string.search_medications)
        }
        results.medicationPlans.forEach { medication ->
            item { MedicationResultCard(medication) { onNavigate(DaynestDestination.MEDICATION) } }
        }
    }
    if (results.plannedItems.isNotEmpty()) {
        item {
            SectionHeader(R.string.search_planned_items)
        }
        results.plannedItems.forEach { plannedItem ->
            item { PlannedItemResultCard(plannedItem) { onNavigate(DaynestDestination.CALENDAR) } }
        }
    }
}

@Composable
private fun SectionHeader(titleRes: Int) {
    Text(text = stringResource(id = titleRes), style = MaterialTheme.typography.titleMedium)
}

@Composable
private fun RoutineResultCard(routine: RoutineSearchResultDto, onClick: () -> Unit) {
    ResultCard(
        title = routine.name,
        subtitle = routine.description,
        trailing = if (!routine.isActive) stringResource(id = R.string.search_inactive) else null,
        onClick = onClick
    )
}

@Composable
private fun ChoreResultCard(chore: ChoreSearchResultDto, onClick: () -> Unit) {
    ResultCard(
        title = chore.name,
        subtitle = chore.description,
        trailing = if (!chore.isActive) stringResource(id = R.string.search_inactive) else null,
        onClick = onClick
    )
}

@Composable
private fun MedicationResultCard(medication: MedicationSearchResultDto, onClick: () -> Unit) {
    ResultCard(
        title = medication.name,
        subtitle = medication.instructions.takeIf { it.isNotBlank() },
        trailing = if (!medication.isActive) stringResource(id = R.string.search_inactive) else null,
        onClick = onClick
    )
}

@Composable
private fun PlannedItemResultCard(plannedItem: PlannedItemSearchResultDto, onClick: () -> Unit) {
    ResultCard(
        title = plannedItem.title,
        subtitle = plannedItem.notes,
        trailing =
        stringResource(
            id = if (plannedItem.isDone) R.string.search_done else R.string.search_planned
        ),
        onClick = onClick
    )
}

@Composable
private fun ResultCard(title: String, subtitle: String?, trailing: String?, onClick: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth()) {
        TextButton(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.fillMaxWidth()) {
                Text(text = title, style = MaterialTheme.typography.bodyMedium)
                subtitle?.let {
                    Text(
                        text = it,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.outline
                    )
                }
                trailing?.let {
                    Text(
                        text = it,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.outline
                    )
                }
            }
        }
    }
}
