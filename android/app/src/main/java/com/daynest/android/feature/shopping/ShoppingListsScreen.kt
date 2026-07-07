@file:Suppress("ktlint:standard:function-naming", "FunctionNaming")

package com.daynest.android.feature.shopping

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
import androidx.compose.material3.Card
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
import com.daynest.android.data.shopping.ShoppingListDto
import com.daynest.android.data.shopping.ShoppingListStatus

@Composable
fun ShoppingListsRoute(
    onNavigate: (String) -> Unit = {},
    onOpenList: (Int) -> Unit,
    onOpenRecurringGroceries: () -> Unit = {},
    viewModel: ShoppingViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(viewModel) {
        viewModel.effects.collect { snackbarHostState.showSnackbar(it) }
    }

    ShoppingListsScreen(
        uiState = uiState,
        onNavigate = onNavigate,
        onRefresh = viewModel::refreshLists,
        onCreate = viewModel::createList,
        onArchive = viewModel::archiveList,
        onDelete = viewModel::deleteList,
        onOpenList = onOpenList,
        onOpenRecurringGroceries = onOpenRecurringGroceries,
        snackbarHostState = snackbarHostState
    )
}

@Composable
internal fun ShoppingListsScreen(
    uiState: ShoppingUiState,
    onNavigate: (String) -> Unit,
    onRefresh: () -> Unit,
    onCreate: (String, String?, String?) -> Unit,
    onArchive: (ShoppingListDto) -> Unit,
    onDelete: (Int) -> Unit,
    onOpenList: (Int) -> Unit,
    onOpenRecurringGroceries: () -> Unit,
    snackbarHostState: SnackbarHostState
) {
    DaynestNavigationScaffold(
        currentRoute = DaynestDestination.SHOPPING,
        onNavigate = onNavigate,
        snackbarHostState = snackbarHostState
    ) { innerPadding ->
        ShoppingListsContent(
            uiState = uiState,
            onRefresh = onRefresh,
            onCreate = onCreate,
            onArchive = onArchive,
            onDelete = onDelete,
            onOpenList = onOpenList,
            onOpenRecurringGroceries = onOpenRecurringGroceries,
            modifier = Modifier.padding(innerPadding)
        )
    }
}

@Composable
private fun ShoppingListsContent(
    uiState: ShoppingUiState,
    onRefresh: () -> Unit,
    onCreate: (String, String?, String?) -> Unit,
    onArchive: (ShoppingListDto) -> Unit,
    onDelete: (Int) -> Unit,
    onOpenList: (Int) -> Unit,
    onOpenRecurringGroceries: () -> Unit,
    modifier: Modifier = Modifier
) {
    val activeLists =
        remember(uiState.lists) {
            uiState.lists.filter { it.status == ShoppingListStatus.ACTIVE }
        }
    val archivedLists =
        remember(uiState.lists) {
            uiState.lists.filter { it.status == ShoppingListStatus.ARCHIVED }
        }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item { ShoppingListsHeader(onRefresh = onRefresh) }
        item {
            TextButton(onClick = onOpenRecurringGroceries) {
                Text(text = stringResource(id = R.string.shopping_recurring_manage))
            }
        }

        if (uiState.isLoadingLists) {
            item { LoadingIndicator() }
        }

        uiState.error?.let { message ->
            item { ErrorText(message = message) }
        }

        item { CreateListForm(onCreate = onCreate) }

        activeListsSection(activeLists, uiState.isLoadingLists, onOpenList, onArchive, onDelete)
        archivedListsSection(archivedLists, onOpenList, onArchive, onDelete)
    }
}

private fun LazyListScope.activeListsSection(
    activeLists: List<ShoppingListDto>,
    isLoadingLists: Boolean,
    onOpenList: (Int) -> Unit,
    onArchive: (ShoppingListDto) -> Unit,
    onDelete: (Int) -> Unit
) {
    item {
        Text(
            text = stringResource(id = R.string.shopping_active_lists),
            style = MaterialTheme.typography.titleMedium
        )
    }
    if (activeLists.isEmpty() && !isLoadingLists) {
        item { Text(text = stringResource(id = R.string.shopping_no_lists)) }
    }
    items(activeLists, key = { it.id }) { list ->
        ShoppingListCard(
            list = list,
            onOpenList = onOpenList,
            onArchive = onArchive,
            onDelete = onDelete
        )
    }
}

private fun LazyListScope.archivedListsSection(
    archivedLists: List<ShoppingListDto>,
    onOpenList: (Int) -> Unit,
    onArchive: (ShoppingListDto) -> Unit,
    onDelete: (Int) -> Unit
) {
    if (archivedLists.isNotEmpty()) {
        item {
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = stringResource(id = R.string.shopping_archived),
                style = MaterialTheme.typography.titleMedium
            )
        }
        items(archivedLists, key = { it.id }) { list ->
            ShoppingListCard(
                list = list,
                onOpenList = onOpenList,
                onArchive = onArchive,
                onDelete = onDelete
            )
        }
    }
}

@Composable
private fun ShoppingListsHeader(onRefresh: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = stringResource(id = R.string.shopping_title),
                style = MaterialTheme.typography.headlineMedium
            )
            Text(
                text = stringResource(id = R.string.shopping_subtitle),
                style = MaterialTheme.typography.bodyMedium
            )
        }
        TextButton(onClick = onRefresh) { Text(text = stringResource(id = R.string.action_refresh)) }
    }
}

@Composable
private fun LoadingIndicator() {
    Column(modifier = Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        CircularProgressIndicator()
    }
}

@Composable
private fun ErrorText(message: String) {
    Text(text = message, color = MaterialTheme.colorScheme.error)
}

@Composable
private fun CreateListForm(onCreate: (String, String?, String?) -> Unit) {
    var name by remember { mutableStateOf("") }
    var store by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }

    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = stringResource(id = R.string.shopping_create_list),
                style = MaterialTheme.typography.titleMedium
            )
            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text(text = stringResource(id = R.string.shopping_list_name)) },
                modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = store,
                onValueChange = { store = it },
                label = { Text(text = stringResource(id = R.string.shopping_store)) },
                modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = notes,
                onValueChange = { notes = it },
                label = { Text(text = stringResource(id = R.string.shopping_notes)) },
                modifier = Modifier.fillMaxWidth()
            )
            Button(
                onClick = {
                    onCreate(name, store, notes)
                    name = ""
                    store = ""
                    notes = ""
                },
                enabled = name.isNotBlank()
            ) {
                Text(text = stringResource(id = R.string.action_add))
            }
        }
    }
}

@Composable
private fun ShoppingListCard(
    list: ShoppingListDto,
    onOpenList: (Int) -> Unit,
    onArchive: (ShoppingListDto) -> Unit,
    onDelete: (Int) -> Unit
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(text = list.name, style = MaterialTheme.typography.titleMedium)
            list.store?.let { Text(text = it, style = MaterialTheme.typography.bodyMedium) }
            list.notes?.let { Text(text = it, style = MaterialTheme.typography.bodySmall) }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { onOpenList(list.id) }) {
                    Text(text = stringResource(id = R.string.shopping_open_list))
                }
                if (list.status == ShoppingListStatus.ACTIVE) {
                    TextButton(onClick = { onArchive(list) }) {
                        Text(text = stringResource(id = R.string.shopping_archive))
                    }
                }
                TextButton(onClick = { onDelete(list.id) }) {
                    Text(text = stringResource(id = R.string.action_delete))
                }
            }
        }
    }
}
