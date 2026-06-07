@file:Suppress("ktlint:standard:function-naming", "FunctionNaming")

package com.daynest.android.feature.calendar

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.daynest.android.R
import com.daynest.android.data.calendar.DeviceCalendarEvent
import java.time.ZoneId
import java.time.format.DateTimeFormatter

@Composable
internal fun DeviceCalendarSectionHeader(
    status: DeviceCalendarStatus,
    context: Context,
) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(
            text = stringResource(id = R.string.calendar_device_events_header),
            style = MaterialTheme.typography.titleSmall,
        )
        when (status) {
            DeviceCalendarStatus.Loading -> CircularProgressIndicator(modifier = Modifier.size(20.dp))
            DeviceCalendarStatus.Empty ->
                Text(
                    text = stringResource(id = R.string.calendar_device_events_empty),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.outline,
                )
            DeviceCalendarStatus.NoEnabledCalendars ->
                Text(
                    text = stringResource(id = R.string.calendar_device_events_no_calendars),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.outline,
                )
            DeviceCalendarStatus.PermissionRequired -> {
                Text(
                    text = stringResource(id = R.string.calendar_device_events_permission_required),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.outline,
                )
                TextButton(onClick = { context.openAppSettings() }) {
                    Text(text = stringResource(id = R.string.action_open_settings))
                }
            }
            else -> Unit
        }
    }
}

@Composable
internal fun DeviceCalendarEventCard(item: DeviceCalendarEvent) {
    val color = remember(item.color) { Color(item.color or 0xFF000000.toInt()) }
    val allDayText = stringResource(id = R.string.calendar_device_event_all_day)
    val timeText = remember(item.startsAt, item.endsAt, item.allDay, allDayText) {
        item.deviceEventTimeText(allDayText)
    }
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Spacer(
                modifier =
                    Modifier
                        .size(width = 4.dp, height = 48.dp)
                        .background(color),
            )
            Column(
                modifier =
                    Modifier
                        .weight(1f)
                        .padding(start = 12.dp),
            ) {
                Text(text = item.title, style = MaterialTheme.typography.bodyMedium)
                Text(
                    text = stringResource(id = R.string.calendar_device_event_meta, item.calendarName, timeText),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.primary,
                )
                if (!item.description.isNullOrBlank()) {
                    Text(
                        text = item.description,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.outline,
                    )
                }
            }
        }
    }
}

private fun DeviceCalendarEvent.deviceEventTimeText(allDayText: String): String {
    if (allDay) return allDayText
    val formatter = DateTimeFormatter.ofPattern("HH:mm").withZone(ZoneId.systemDefault())
    return "${formatter.format(startsAt)}–${formatter.format(endsAt)}"
}

private fun Context.openAppSettings() {
    startActivity(
        Intent(
            Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
            Uri.fromParts("package", packageName, null),
        ),
    )
}
