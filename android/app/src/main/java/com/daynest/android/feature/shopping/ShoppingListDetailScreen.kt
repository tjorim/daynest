@file:Suppress("ktlint:standard:function-naming", "FunctionNaming")

package com.daynest.android.feature.shopping

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import com.daynest.android.data.today.PlannedTodayItemDto

@Composable
fun ShoppingListDetailRoute(
    listId: Int,
    onNavigate: (String) -> Unit = {},
    onBack: () -> Unit,
    viewModel: ShoppingViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(viewModel) {
        viewModel.effects.collect { snackbarHostState.showSnackbar(it) }
    }
    LaunchedEffect(listId) {
        viewModel.selectList(listId)
    }

    DaynestNavigationScaffold(
        currentRoute = DaynestDestination.SHOPPING,
        onNavigate = onNavigate,
        snackbarHostState = snackbarHostState,
    ) { innerPadding ->
        ShoppingListDetailContent(
            uiState = uiState,
            onBack = {
                viewModel.clearSelection()
                onBack()
            },
            onRefresh = { viewModel.selectList(listId) },
            onAddItem = viewModel::addItem,
            onCheckOff = viewModel::checkOffItem,
            modifier = Modifier.padding(innerPadding),
        )
    }
}

@Composable
private fun ShoppingListDetailContent(
    uiState: ShoppingUiState,
    onBack: () -> Unit,
    onRefresh: () -> Unit,
    onAddItem: (String, String?, String?) -> Unit,
    onCheckOff: (PlannedTodayItemDto) -> Unit,
    modifier: Modifier = Modifier,
) {
    var itemTitle by remember { mutableStateOf("") }
    var itemTag by remember { mutableStateOf("") }
    var itemNotes by remember { mutableStateOf("") }
    val openItems = uiState.items.filterNot { it.isDone }
    val completedItems = uiState.items.filter { it.isDone }
    val uncategorizedLabel = stringResource(id = R.string.shopping_uncategorized)
    val groupedOpenItems = openItems.groupBy { it.tags.firstOrNull()?.takeIf(String::isNotBlank) ?: uncategorizedLabel }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            TextButton(onClick = onBack) { Text(text = stringResource(id = R.string.shopping_back_to_lists)) }
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(text = uiState.selectedList?.name ?: stringResource(id = R.string.shopping_title), style = MaterialTheme.typography.headlineMedium)
                    Text(text = stringResource(id = R.string.shopping_item_count, openItems.size), style = MaterialTheme.typography.bodyMedium)
                }
                TextButton(onClick = onRefresh) { Text(text = stringResource(id = R.string.action_refresh)) }
            }
            uiState.selectedList?.notes?.let { Text(text = it, style = MaterialTheme.typography.bodyMedium) }
        }

        if (uiState.isLoadingItems) {
            item {
                Column(modifier = Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                    CircularProgressIndicator()
                }
            }
        }

        uiState.error?.let { message ->
            item { Text(text = message, color = MaterialTheme.colorScheme.error) }
        }

        item {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(text = stringResource(id = R.string.shopping_add_item), style = MaterialTheme.typography.titleMedium)
                    OutlinedTextField(
                        value = itemTitle,
                        onValueChange = { itemTitle = it },
                        label = { Text(text = stringResource(id = R.string.shopping_item_name)) },
                        modifier = Modifier.fillMaxWidth(),
                    )
                    OutlinedTextField(
                        value = itemTag,
                        onValueChange = { itemTag = it },
                        label = { Text(text = stringResource(id = R.string.shopping_category_tag)) },
                        modifier = Modifier.fillMaxWidth(),
                    )
                    OutlinedTextField(
                        value = itemNotes,
                        onValueChange = { itemNotes = it },
                        label = { Text(text = stringResource(id = R.string.shopping_notes)) },
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Button(
                        onClick = {
                            onAddItem(itemTitle, itemTag, itemNotes)
                            itemTitle = ""
                            itemTag = ""
                            itemNotes = ""
                        },
                        enabled = itemTitle.isNotBlank(),
                    ) {
                        Text(text = stringResource(id = R.string.action_add))
                    }
                }
            }
        }

        if (groupedOpenItems.isEmpty() && !uiState.isLoadingItems) {
            item { Text(text = stringResource(id = R.string.shopping_no_items)) }
        }
        groupedOpenItems.forEach { (tag, itemsForTag) ->
            item { Text(text = tag, style = MaterialTheme.typography.titleMedium) }
            items(itemsForTag, key = { it.id }) { item ->
                ShoppingItemRow(item = item, onCheckOff = onCheckOff)
            }
        }
        if (completedItems.isNotEmpty()) {
            item { Text(text = stringResource(id = R.string.shopping_completed_items, completedItems.size), style = MaterialTheme.typography.titleMedium) }
            items(completedItems, key = { it.id }) { item ->
                Text(text = item.title, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable
private fun ShoppingItemRow(
    item: PlannedTodayItemDto,
    onCheckOff: (PlannedTodayItemDto) -> Unit,
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier =
                Modifier
                    .padding(12.dp)
                    .fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Checkbox(checked = item.isDone, onCheckedChange = { checked -> if (checked) onCheckOff(item) })
            Column(modifier = Modifier.weight(1f)) {
                Text(text = item.title, style = MaterialTheme.typography.titleMedium)
                Text(text = stringResource(id = R.string.shopping_planned_for_date, item.plannedFor), style = MaterialTheme.typography.bodySmall)
                item.notes?.let { Text(text = it, style = MaterialTheme.typography.bodySmall) }
            }
            Button(onClick = { onCheckOff(item) }) { Text(text = stringResource(id = R.string.shopping_check_off)) }
        }
    }
}
