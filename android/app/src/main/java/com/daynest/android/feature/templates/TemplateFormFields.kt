@file:Suppress("ktlint:standard:function-naming", "FunctionNaming")

package com.daynest.android.feature.templates

import android.text.format.DateFormat
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import com.daynest.android.R

@Composable
fun TemplateCommonFields(
    name: String,
    onNameChange: (String) -> Unit,
    description: String,
    onDescriptionChange: (String) -> Unit,
    startDate: String,
    onStartDateClick: () -> Unit,
    everyNDays: String,
    onEveryNDaysChange: (String) -> Unit,
    isActive: Boolean,
    onIsActiveToggle: () -> Unit,
) {
    TemplateNameDescriptionFields(
        name = name,
        onNameChange = onNameChange,
        description = description,
        onDescriptionChange = onDescriptionChange,
    )
    TemplateDateField(startDate = startDate, onEditClick = onStartDateClick)
    TemplateEveryNDaysField(
        everyNDays = everyNDays,
        onEveryNDaysChange = onEveryNDaysChange,
    )
    TemplateActiveToggle(isActive = isActive, onClick = onIsActiveToggle)
}

@Composable
fun TemplateNameDescriptionFields(
    name: String,
    onNameChange: (String) -> Unit,
    description: String,
    onDescriptionChange: (String) -> Unit,
) {
    OutlinedTextField(
        value = name,
        onValueChange = onNameChange,
        label = { Text(stringResource(R.string.templates_name_label)) },
        singleLine = true,
    )
    OutlinedTextField(
        value = description,
        onValueChange = onDescriptionChange,
        label = { Text(stringResource(R.string.templates_description_label)) },
        singleLine = true,
    )
}

@Composable
fun TemplateDateField(
    startDate: String,
    onEditClick: () -> Unit,
) {
    OutlinedTextField(
        value = startDate,
        onValueChange = {},
        label = { Text(stringResource(R.string.templates_start_date_label)) },
        singleLine = true,
        readOnly = true,
        trailingIcon = {
            TextButton(onClick = onEditClick) {
                Text(text = stringResource(R.string.action_edit))
            }
        },
    )
}

@Composable
fun TemplateEveryNDaysField(
    everyNDays: String,
    onEveryNDaysChange: (String) -> Unit,
) {
    OutlinedTextField(
        value = everyNDays,
        onValueChange = { onEveryNDaysChange(it.filter { c -> c.isDigit() }) },
        label = { Text(stringResource(R.string.templates_every_n_days_label)) },
        singleLine = true,
    )
}

@Composable
fun TemplateDueTimeField(
    dueTime: String,
    onEditClick: () -> Unit,
) {
    OutlinedTextField(
        value = dueTime,
        onValueChange = {},
        label = { Text(stringResource(R.string.templates_due_time_label)) },
        singleLine = true,
        readOnly = true,
        trailingIcon = {
            TextButton(onClick = onEditClick) {
                Text(text = stringResource(R.string.action_edit))
            }
        },
    )
}

@Composable
fun TemplateActiveToggle(
    isActive: Boolean,
    onClick: () -> Unit,
) {
    TextButton(onClick = onClick) {
        Text(text = activeLabel(isActive))
    }
}

@Composable
fun TemplateDatePickerLauncher(
    isVisible: Boolean,
    initialDate: String,
    onDateSelected: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    if (isVisible) {
        TemplateDatePickerDialog(
            initialDate = initialDate,
            onDateSelected = onDateSelected,
            onDismiss = onDismiss,
        )
    }
}

@Composable
fun TemplateTimePickerLauncher(
    isVisible: Boolean,
    initialTime: String,
    onTimeSelected: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    if (isVisible) {
        TemplateTimePickerDialog(
            initialTime = initialTime,
            onTimeSelected = onTimeSelected,
            onDismiss = onDismiss,
        )
    }
}

@Composable
@OptIn(ExperimentalMaterial3Api::class)
private fun TemplateDatePickerDialog(
    initialDate: String,
    onDateSelected: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    val datePickerState =
        rememberDatePickerState(
            initialSelectedDateMillis = initialDate.toEpochMillisOrNull(),
        )

    DatePickerDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(
                onClick = {
                    datePickerState.selectedDateMillis
                        ?.toLocalDateString()
                        ?.let(onDateSelected)
                    onDismiss()
                },
            ) {
                Text(text = stringResource(id = R.string.action_done))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(text = stringResource(id = R.string.action_cancel))
            }
        },
    ) {
        DatePicker(state = datePickerState)
    }
}

@Composable
@OptIn(ExperimentalMaterial3Api::class)
private fun TemplateTimePickerDialog(
    initialTime: String,
    onTimeSelected: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    val context = LocalContext.current
    val is24Hour = remember(context) { DateFormat.is24HourFormat(context) }
    val timePickerState =
        rememberTimePickerState(
            initialHour = initialTime.timePartAt(0, defaultValue = 8, range = 0..23),
            initialMinute = initialTime.timePartAt(1, defaultValue = 0, range = 0..59),
            is24Hour = is24Hour,
        )

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(text = stringResource(id = R.string.templates_due_time_label)) },
        text = { TimePicker(state = timePickerState) },
        confirmButton = {
            TextButton(
                onClick = {
                    onTimeSelected("%02d:%02d".format(timePickerState.hour, timePickerState.minute))
                    onDismiss()
                },
            ) {
                Text(text = stringResource(id = R.string.action_done))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(text = stringResource(id = R.string.action_cancel))
            }
        },
    )
}
