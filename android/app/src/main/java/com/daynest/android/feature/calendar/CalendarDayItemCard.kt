@file:Suppress("ktlint:standard:function-naming", "FunctionNaming")

package com.daynest.android.feature.calendar

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.daynest.android.R
import com.daynest.android.data.calendar.UnifiedDayItemDto

@Composable
internal fun DayItemCard(
    item: UnifiedDayItemDto,
    onEdit: (() -> Unit)?,
    onDelete: (() -> Unit)?,
    onDeleteFuture: (() -> Unit)? = null
) {
    val isRecurring = item.rrule != null || item.recurrenceSeriesId != null
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier =
            Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                val displayTitle =
                    if (isRecurring) stringResource(R.string.planned_item_recurring_title, item.title) else item.title
                Text(
                    text = displayTitle,
                    style = MaterialTheme.typography.bodyMedium
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = item.itemType,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.primary
                    )
                    if (item.status.isNotEmpty()) {
                        Text(
                            text = item.status,
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.outline
                        )
                    }
                }
                if (!item.detail.isNullOrBlank()) {
                    Text(
                        text = item.detail,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.outline
                    )
                }
            }
            if (onEdit != null) {
                TextButton(onClick = onEdit) {
                    Text(text = stringResource(id = R.string.action_edit))
                }
            }
            if (onDelete != null) {
                DayItemDeleteButtons(isRecurring, onDelete, onDeleteFuture)
            }
        }
    }
}

@Composable
private fun DayItemDeleteButtons(isRecurring: Boolean, onDelete: () -> Unit, onDeleteFuture: (() -> Unit)?) {
    if (isRecurring && onDeleteFuture != null) {
        TextButton(onClick = onDelete) {
            Text(
                text = stringResource(id = R.string.action_delete_this),
                color = MaterialTheme.colorScheme.error
            )
        }
        TextButton(onClick = onDeleteFuture) {
            Text(
                text = stringResource(id = R.string.action_delete_this_and_future),
                color = MaterialTheme.colorScheme.error
            )
        }
    } else {
        TextButton(onClick = onDelete) {
            Text(
                text = stringResource(id = R.string.action_delete),
                color = MaterialTheme.colorScheme.error
            )
        }
    }
}
