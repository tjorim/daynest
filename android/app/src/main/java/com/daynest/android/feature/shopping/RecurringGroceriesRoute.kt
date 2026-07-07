@file:Suppress("ktlint:standard:function-naming", "FunctionNaming")

package com.daynest.android.feature.shopping

import android.app.DatePickerDialog
import android.content.Context
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuAnchorType
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.daynest.android.R
import com.daynest.android.data.shopping.ShoppingListDto
import java.time.LocalDate

@Composable
fun RecurringGroceriesRoute(onBack: () -> Unit, viewModel: RecurringGroceriesViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(viewModel) {
        viewModel.effects.collect { snackbarHostState.showSnackbar(it) }
    }

    Scaffold(snackbarHost = { SnackbarHost(snackbarHostState) }) { innerPadding ->
        RecurringGroceriesContent(
            uiState = uiState,
            onBack = onBack,
            onSave = viewModel::save,
            onDelete = viewModel::delete,
            modifier = Modifier.padding(innerPadding)
        )
    }
}

@Composable
private fun RecurringGroceriesContent(
    uiState: RecurringGroceriesUiState,
    onBack: () -> Unit,
    onSave: (RecurringGroceryInput, RecurringGrocerySeries?) -> Unit,
    onDelete: (RecurringGrocerySeries) -> Unit,
    modifier: Modifier = Modifier
) {
    var editingSeries by remember { mutableStateOf<RecurringGrocerySeries?>(null) }
    var showForm by remember { mutableStateOf(false) }
    var deleteTarget by remember { mutableStateOf<RecurringGrocerySeries?>(null) }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        recurringGroceriesListItems(
            uiState = uiState,
            onBack = onBack,
            onAddNew = {
                editingSeries = null
                showForm = true
            },
            onEditSeries = { series ->
                editingSeries = series
                showForm = true
            },
            onDeleteRequested = { series -> deleteTarget = series }
        )
    }

    if (showForm) {
        RecurringGroceryFormDialog(
            editing = editingSeries,
            shoppingLists = uiState.shoppingLists,
            onDismiss = { showForm = false },
            onConfirm = { input ->
                onSave(input, editingSeries)
                showForm = false
            }
        )
    }

    deleteTarget?.let { series ->
        DeleteRecurringGroceryDialog(
            series = series,
            onConfirm = {
                onDelete(series)
                deleteTarget = null
            },
            onDismiss = { deleteTarget = null }
        )
    }
}

private fun LazyListScope.recurringGroceriesListItems(
    uiState: RecurringGroceriesUiState,
    onBack: () -> Unit,
    onAddNew: () -> Unit,
    onEditSeries: (RecurringGrocerySeries) -> Unit,
    onDeleteRequested: (RecurringGrocerySeries) -> Unit
) {
    item {
        TextButton(onClick = onBack) { Text(text = stringResource(id = R.string.action_back)) }
    }
    item {
        Column {
            Text(
                text = stringResource(id = R.string.shopping_recurring_page_title),
                style = MaterialTheme.typography.headlineMedium
            )
            Text(
                text = stringResource(id = R.string.shopping_recurring_page_subtitle),
                style = MaterialTheme.typography.bodyMedium
            )
        }
    }
    item {
        Button(onClick = onAddNew) {
            Text(text = stringResource(id = R.string.shopping_recurring_add_new))
        }
    }
    if (uiState.isLoading) {
        item { CircularProgressIndicator() }
    }
    uiState.error?.let { message ->
        item { Text(text = message, color = MaterialTheme.colorScheme.error) }
    }
    if (uiState.series.isEmpty() && !uiState.isLoading) {
        item { Text(text = stringResource(id = R.string.shopping_recurring_no_series)) }
    }
    items(uiState.series, key = { it.key }) { series ->
        RecurringGroceryCard(
            series = series,
            listName = uiState.shoppingLists.firstOrNull { it.id == series.autoAddToListId }?.name,
            onEdit = { onEditSeries(series) },
            onDelete = { onDeleteRequested(series) }
        )
    }
}

@Composable
private fun DeleteRecurringGroceryDialog(series: RecurringGrocerySeries, onConfirm: () -> Unit, onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(text = stringResource(id = R.string.shopping_recurring_delete_title)) },
        text = { Text(text = stringResource(id = R.string.shopping_recurring_delete_message, series.title)) },
        confirmButton = {
            TextButton(onClick = onConfirm) {
                Text(text = stringResource(id = R.string.action_delete))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(text = stringResource(id = R.string.action_cancel))
            }
        }
    )
}

@Composable
private fun RecurringGroceryCard(
    series: RecurringGrocerySeries,
    listName: String?,
    onEdit: () -> Unit,
    onDelete: () -> Unit
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(text = series.title, style = MaterialTheme.typography.titleMedium)
            Text(text = series.rrule, style = MaterialTheme.typography.bodySmall)
            series.recurrenceHint?.let { hint ->
                Text(text = hint, style = MaterialTheme.typography.bodySmall)
            }
            Text(
                text =
                stringResource(
                    id = R.string.shopping_recurring_auto_add_list_format,
                    stringResource(id = R.string.shopping_recurring_auto_add_list_label),
                    listName ?: stringResource(id = R.string.shopping_recurring_auto_add_none)
                ),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.outline
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TextButton(onClick = onEdit) { Text(text = stringResource(id = R.string.shopping_recurring_edit)) }
                TextButton(onClick = onDelete) {
                    Text(
                        text = stringResource(id = R.string.shopping_recurring_delete),
                        color = MaterialTheme.colorScheme.error
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun RecurringGroceryFormDialog(
    editing: RecurringGrocerySeries?,
    shoppingLists: List<ShoppingListDto>,
    onDismiss: () -> Unit,
    onConfirm: (RecurringGroceryInput) -> Unit
) {
    var title by remember { mutableStateOf(editing?.title.orEmpty()) }
    var startDate by remember { mutableStateOf(editing?.startDate.orEmpty()) }
    var rrule by remember { mutableStateOf(editing?.rrule?.takeIf { it.isNotBlank() } ?: "FREQ=WEEKLY") }
    var recurrenceHint by remember { mutableStateOf(editing?.recurrenceHint.orEmpty().ifBlank { "weekly" }) }
    var notes by remember { mutableStateOf(editing?.notes.orEmpty()) }
    var selectedListId by remember { mutableStateOf(editing?.autoAddToListId) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(text = stringResource(id = R.string.shopping_recurring_add_new)) },
        text = {
            RecurringGroceryFormFields(
                title = title,
                onTitleChange = { title = it },
                startDate = startDate,
                onStartDateChange = { startDate = it },
                rrule = rrule,
                onRruleChange = { rrule = it },
                recurrenceHint = recurrenceHint,
                onRecurrenceHintChange = { recurrenceHint = it },
                notes = notes,
                onNotesChange = { notes = it },
                shoppingLists = shoppingLists,
                selectedListId = selectedListId,
                onSelectedListIdChange = { selectedListId = it }
            )
        },
        confirmButton = {
            TextButton(
                onClick = {
                    onConfirm(
                        RecurringGroceryInput(
                            title = title,
                            startDate = startDate,
                            notes = notes.ifBlank { null },
                            rrule = rrule,
                            recurrenceHint = recurrenceHint.ifBlank { null },
                            autoAddToListId = selectedListId
                        )
                    )
                },
                enabled = title.isNotBlank() && startDate.isNotBlank() && rrule.isNotBlank()
            ) {
                Text(text = stringResource(id = R.string.action_add))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(text = stringResource(id = R.string.action_cancel))
            }
        }
    )
}

@Composable
private fun RecurringGroceryFormFields(
    title: String,
    onTitleChange: (String) -> Unit,
    startDate: String,
    onStartDateChange: (String) -> Unit,
    rrule: String,
    onRruleChange: (String) -> Unit,
    recurrenceHint: String,
    onRecurrenceHintChange: (String) -> Unit,
    notes: String,
    onNotesChange: (String) -> Unit,
    shoppingLists: List<ShoppingListDto>,
    selectedListId: Int?,
    onSelectedListIdChange: (Int?) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedTextField(
            value = title,
            onValueChange = onTitleChange,
            label = { Text(text = stringResource(id = R.string.shopping_item_name)) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        RecurringGroceryDateField(value = startDate, onSelected = onStartDateChange)
        OutlinedTextField(
            value = rrule,
            onValueChange = onRruleChange,
            label = { Text(text = stringResource(id = R.string.shopping_recurring_rrule)) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = recurrenceHint,
            onValueChange = onRecurrenceHintChange,
            label = { Text(text = stringResource(id = R.string.shopping_recurring_hint)) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = notes,
            onValueChange = onNotesChange,
            label = { Text(text = stringResource(id = R.string.shopping_notes)) },
            modifier = Modifier.fillMaxWidth()
        )
        RecurringGroceryListPicker(
            shoppingLists = shoppingLists,
            selectedListId = selectedListId,
            onSelectedListIdChange = onSelectedListIdChange
        )
    }
}

@Composable
private fun RecurringGroceryDateField(value: String, onSelected: (String) -> Unit) {
    val context = LocalContext.current
    OutlinedTextField(
        value = value,
        onValueChange = {},
        readOnly = true,
        label = { Text(text = stringResource(id = R.string.shopping_recurring_start_date)) },
        singleLine = true,
        modifier =
        Modifier.fillMaxWidth().clickableDatePicker(context = context, initialValue = value, onSelected = onSelected)
    )
}

private fun Modifier.clickableDatePicker(
    context: Context,
    initialValue: String,
    onSelected: (String) -> Unit
): Modifier {
    val initialDate = runCatching { LocalDate.parse(initialValue) }.getOrDefault(LocalDate.now())
    return this.then(
        Modifier
            .focusProperties { canFocus = false }
            .clickable {
                DatePickerDialog(
                    context,
                    { _, year, month, day -> onSelected(LocalDate.of(year, month + 1, day).toString()) },
                    initialDate.year,
                    initialDate.monthValue - 1,
                    initialDate.dayOfMonth
                ).show()
            }
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun RecurringGroceryListPicker(
    shoppingLists: List<ShoppingListDto>,
    selectedListId: Int?,
    onSelectedListIdChange: (Int?) -> Unit
) {
    var listPickerExpanded by remember { mutableStateOf(false) }
    ExposedDropdownMenuBox(
        expanded = listPickerExpanded,
        onExpandedChange = { listPickerExpanded = it }
    ) {
        OutlinedTextField(
            value =
            shoppingLists.firstOrNull { it.id == selectedListId }?.name
                ?: stringResource(id = R.string.shopping_recurring_auto_add_none),
            onValueChange = {},
            readOnly = true,
            label = { Text(text = stringResource(id = R.string.shopping_recurring_auto_add_list_label)) },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = listPickerExpanded) },
            modifier =
            Modifier
                .fillMaxWidth()
                .menuAnchor(ExposedDropdownMenuAnchorType.PrimaryNotEditable)
        )
        ExposedDropdownMenu(
            expanded = listPickerExpanded,
            onDismissRequest = { listPickerExpanded = false }
        ) {
            DropdownMenuItem(
                text = { Text(text = stringResource(id = R.string.shopping_recurring_auto_add_none)) },
                onClick = {
                    onSelectedListIdChange(null)
                    listPickerExpanded = false
                }
            )
            shoppingLists.forEach { list ->
                DropdownMenuItem(
                    text = { Text(text = list.name) },
                    onClick = {
                        onSelectedListIdChange(list.id)
                        listPickerExpanded = false
                    }
                )
            }
        }
    }
}
