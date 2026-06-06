@file:Suppress("ktlint:standard:function-naming", "FunctionNaming")

package com.daynest.android.feature.shopping

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SheetState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.daynest.android.R
import java.time.LocalDate

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun RecurringItemBottomSheet(
    sheetState: SheetState,
    onAddRecurringItem: (String, String, String?, String?, String?, String?) -> Unit,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState) {
        AddRecurringItemSheet(
            onAddRecurringItem = { title, plannedFor, tag, notes, rrule, recurrenceHint ->
                onAddRecurringItem(title, plannedFor, tag, notes, rrule, recurrenceHint)
                onDismiss()
            },
            onDismiss = onDismiss,
        )
    }
}

@Composable
internal fun AddRecurringItemSheet(
    onAddRecurringItem: (String, String, String?, String?, String?, String?) -> Unit,
    onDismiss: () -> Unit,
) {
    var itemTitle by remember { mutableStateOf("") }
    var plannedFor by remember { mutableStateOf(LocalDate.now().toString()) }
    var itemTag by remember { mutableStateOf("") }
    var itemNotes by remember { mutableStateOf("") }
    var rrule by remember { mutableStateOf("FREQ=WEEKLY") }
    var recurrenceHint by remember { mutableStateOf("weekly") }

    Column(
        modifier = Modifier.fillMaxWidth().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(
            text = stringResource(id = R.string.shopping_add_recurring_item),
            style = MaterialTheme.typography.titleMedium,
        )
        OutlinedTextField(
            value = itemTitle,
            onValueChange = { itemTitle = it },
            label = { Text(text = stringResource(id = R.string.shopping_item_name)) },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
        )
        OutlinedTextField(
            value = plannedFor,
            onValueChange = { plannedFor = it },
            label = { Text(text = stringResource(id = R.string.shopping_recurring_start_date)) },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
        )
        RecurringScheduleFields(
            rrule = rrule,
            onRruleChange = { rrule = it },
            recurrenceHint = recurrenceHint,
            onRecurrenceHintChange = { recurrenceHint = it },
        )
        OutlinedTextField(
            value = itemTag,
            onValueChange = { itemTag = it },
            label = { Text(text = stringResource(id = R.string.shopping_category_tag)) },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
        )
        OutlinedTextField(
            value = itemNotes,
            onValueChange = { itemNotes = it },
            label = { Text(text = stringResource(id = R.string.shopping_notes)) },
            modifier = Modifier.fillMaxWidth(),
        )
        RecurringItemSheetActions(
            onDismiss = onDismiss,
            onAdd = { onAddRecurringItem(itemTitle, plannedFor, itemTag, itemNotes, rrule, recurrenceHint) },
            isAddEnabled = itemTitle.isNotBlank() && plannedFor.isNotBlank(),
        )
    }
}

@Composable
private fun RecurringScheduleFields(
    rrule: String,
    onRruleChange: (String) -> Unit,
    recurrenceHint: String,
    onRecurrenceHintChange: (String) -> Unit,
) {
    OutlinedTextField(
        value = rrule,
        onValueChange = onRruleChange,
        label = { Text(text = stringResource(id = R.string.shopping_recurring_rrule)) },
        modifier = Modifier.fillMaxWidth(),
        singleLine = true,
    )
    OutlinedTextField(
        value = recurrenceHint,
        onValueChange = onRecurrenceHintChange,
        label = { Text(text = stringResource(id = R.string.shopping_recurring_hint)) },
        modifier = Modifier.fillMaxWidth(),
        singleLine = true,
    )
}

@Composable
private fun RecurringItemSheetActions(
    onDismiss: () -> Unit,
    onAdd: () -> Unit,
    isAddEnabled: Boolean,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.End),
    ) {
        TextButton(onClick = onDismiss) { Text(text = stringResource(id = R.string.action_cancel)) }
        Button(onClick = onAdd, enabled = isAddEnabled) { Text(text = stringResource(id = R.string.action_add)) }
    }
}
