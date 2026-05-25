@file:Suppress("ktlint:standard:function-naming", "FunctionNaming")

package com.daynest.android.feature.home

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import com.daynest.android.R
import com.daynest.android.data.today.MedicationTodayItemDto
import com.daynest.android.data.today.PlannedTodayItemDto
import com.daynest.android.data.today.RoutineTodayItemDto
import com.daynest.android.data.today.UpcomingTodayItemDto

@Composable
internal fun MedicationTodayCard(
    item: MedicationTodayItemDto,
    onTake: () -> Unit,
    onSkip: () -> Unit,
) {
    val isScheduled = item.status == "scheduled"

    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(text = item.name, style = MaterialTheme.typography.bodyMedium)
                if (item.instructions.isNotEmpty()) {
                    Text(
                        text = item.instructions,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.outline,
                    )
                }
            }
            if (isScheduled) {
                TextButton(onClick = onTake) {
                    Text(text = stringResource(id = R.string.action_take))
                }
                TextButton(onClick = onSkip) {
                    Text(text = stringResource(id = R.string.action_skip))
                }
            } else {
                Text(
                    text = item.status,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.outline,
                )
            }
        }
    }
}

@Composable
internal fun RoutineCard(
    item: RoutineTodayItemDto,
    isSelected: Boolean,
    onToggleSelect: () -> Unit,
    onStart: () -> Unit,
    onComplete: () -> Unit,
    onSkip: () -> Unit,
) {
    val isDone = item.status == "completed"
    val isSkipped = item.status == "skipped"
    val canStart = item.status == "pending"
    val canMutate = !isDone && !isSkipped
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Checkbox(checked = isSelected, onCheckedChange = { onToggleSelect() })
            Text(
                text = item.title,
                style = MaterialTheme.typography.bodyMedium,
                textDecoration = if (isDone) TextDecoration.LineThrough else TextDecoration.None,
                modifier = Modifier.weight(1f),
            )
            if (canMutate) {
                if (canStart) {
                    TextButton(onClick = onStart) {
                        Text(text = stringResource(id = R.string.action_start))
                    }
                }
                TextButton(onClick = onComplete) {
                    Text(text = stringResource(id = R.string.action_done))
                }
                TextButton(onClick = onSkip) {
                    Text(text = stringResource(id = R.string.action_skip))
                }
            }
        }
    }
}

@Composable
internal fun ChoreCard(
    title: String,
    subtitle: String?,
    isSelected: Boolean,
    onToggleSelect: () -> Unit,
    onComplete: () -> Unit,
    onSkip: () -> Unit,
    onReschedule: () -> Unit,
    onSnooze: () -> Unit,
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Checkbox(checked = isSelected, onCheckedChange = { onToggleSelect() })
            Column(modifier = Modifier.weight(1f)) {
                Text(text = title, style = MaterialTheme.typography.bodyMedium)
                if (subtitle != null) {
                    Text(
                        text = subtitle,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.outline,
                    )
                }
            }
            TextButton(onClick = onComplete) {
                Text(text = stringResource(id = R.string.action_done))
            }
            TextButton(onClick = onSkip) {
                Text(text = stringResource(id = R.string.action_skip))
            }
            TextButton(onClick = onSnooze) {
                Text(text = stringResource(id = R.string.action_snooze))
            }
            TextButton(onClick = onReschedule) {
                Text(text = stringResource(id = R.string.action_reschedule))
            }
        }
    }
}

@Composable
internal fun PlannedItemCard(
    item: PlannedTodayItemDto,
    isSelected: Boolean,
    onToggleSelect: () -> Unit,
    onToggleDone: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    onDeleteFuture: (() -> Unit)? = null,
) {
    val isRecurring = item.rrule != null || item.recurrenceSeriesId != null
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Checkbox(checked = isSelected, onCheckedChange = { onToggleSelect() })
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = if (isRecurring) "🔁 ${item.title}" else item.title,
                    style = MaterialTheme.typography.bodyMedium,
                    textDecoration = if (item.isDone) TextDecoration.LineThrough else TextDecoration.None,
                )
                if (!item.notes.isNullOrBlank()) {
                    Text(
                        text = item.notes,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.outline,
                    )
                }
                if (!item.moduleKey.isNullOrBlank()) {
                    Text(
                        text = item.moduleKey,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
            }
            TextButton(onClick = onToggleDone) {
                Text(
                    text =
                        if (item.isDone) {
                            stringResource(id = R.string.action_undo)
                        } else {
                            stringResource(id = R.string.action_done)
                        },
                )
            }
            TextButton(onClick = onEdit) {
                Text(text = stringResource(id = R.string.action_edit))
            }
            if (isRecurring && onDeleteFuture != null) {
                TextButton(
                    onClick = onDelete,
                    colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error),
                ) {
                    Text(text = stringResource(id = R.string.action_delete_this))
                }
                TextButton(
                    onClick = onDeleteFuture,
                    colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error),
                ) {
                    Text(text = stringResource(id = R.string.action_delete_this_and_future))
                }
            } else {
                TextButton(
                    onClick = onDelete,
                    colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error),
                ) {
                    Text(text = stringResource(id = R.string.action_delete))
                }
            }
        }
    }
}

@Composable
internal fun UpcomingChoreCard(
    item: UpcomingTodayItemDto,
    onReschedule: () -> Unit,
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = item.title,
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.weight(1f),
            )
            if (item.scheduledDate.isNotEmpty()) {
                Text(
                    text = item.scheduledDate,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.outline,
                )
            }
            TextButton(onClick = onReschedule) {
                Text(text = stringResource(id = R.string.action_reschedule))
            }
        }
    }
}
