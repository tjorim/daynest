package com.daynest.android.data.calendar

import android.Manifest
import android.content.ContentResolver
import android.content.Context
import android.content.pm.PackageManager
import android.database.Cursor
import android.provider.CalendarContract
import androidx.core.content.ContextCompat
import dagger.hilt.android.qualifiers.ApplicationContext
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@Singleton
class DeviceCalendarRepository
@Inject
constructor(@ApplicationContext private val context: Context) {
    suspend fun listCalendars(): Result<List<DeviceCalendar>> = withContext(Dispatchers.IO) {
        if (!hasReadPermission()) return@withContext Result.success(emptyList())
        runCatching { context.contentResolver.queryDeviceCalendars() }
    }

    suspend fun listEventsForDay(date: LocalDate, enabledCalendarIds: Set<String>): Result<List<DeviceCalendarEvent>> =
        withContext(Dispatchers.IO) {
            if (!hasReadPermission()) {
                return@withContext Result.failure(SecurityException("READ_CALENDAR permission not granted"))
            }
            if (enabledCalendarIds.isEmpty()) {
                return@withContext Result.success(emptyList())
            }
            runCatching { context.contentResolver.queryDeviceEvents(date, enabledCalendarIds) }
        }

    private fun hasReadPermission(): Boolean = ContextCompat.checkSelfPermission(
        context,
        Manifest.permission.READ_CALENDAR
    ) == PackageManager.PERMISSION_GRANTED
}

private fun ContentResolver.queryDeviceCalendars(): List<DeviceCalendar> {
    val projection =
        arrayOf(
            CalendarContract.Calendars._ID,
            CalendarContract.Calendars.CALENDAR_DISPLAY_NAME,
            CalendarContract.Calendars.ACCOUNT_NAME,
            CalendarContract.Calendars.CALENDAR_COLOR,
            CalendarContract.Calendars.VISIBLE
        )
    return query(
        CalendarContract.Calendars.CONTENT_URI,
        projection,
        null,
        null,
        "${CalendarContract.Calendars.CALENDAR_DISPLAY_NAME} ASC"
    )?.use { cursor ->
        buildList {
            val idIndex = cursor.getColumnIndexOrThrow(CalendarContract.Calendars._ID)
            val nameIndex = cursor.getColumnIndexOrThrow(CalendarContract.Calendars.CALENDAR_DISPLAY_NAME)
            val accountIndex = cursor.getColumnIndexOrThrow(CalendarContract.Calendars.ACCOUNT_NAME)
            val colorIndex = cursor.getColumnIndexOrThrow(CalendarContract.Calendars.CALENDAR_COLOR)
            val visibleIndex = cursor.getColumnIndexOrThrow(CalendarContract.Calendars.VISIBLE)
            while (cursor.moveToNext()) {
                add(
                    DeviceCalendar(
                        id = cursor.getLong(idIndex).toString(),
                        name = cursor.getString(nameIndex).orEmpty(),
                        accountName = cursor.getString(accountIndex),
                        color = cursor.getInt(colorIndex),
                        visible = cursor.getInt(visibleIndex) == 1
                    )
                )
            }
        }
    } ?: emptyList()
}

private fun ContentResolver.queryDeviceEvents(
    date: LocalDate,
    enabledCalendarIds: Set<String>
): List<DeviceCalendarEvent> {
    val zone = ZoneId.systemDefault()
    val startMillis = date.atStartOfDay(zone).toInstant().toEpochMilli()
    val endMillis =
        date
            .plusDays(1)
            .atStartOfDay(zone)
            .toInstant()
            .toEpochMilli()
    val projection =
        arrayOf(
            CalendarContract.Instances._ID,
            CalendarContract.Instances.CALENDAR_ID,
            CalendarContract.Instances.CALENDAR_DISPLAY_NAME,
            CalendarContract.Instances.TITLE,
            CalendarContract.Instances.DESCRIPTION,
            CalendarContract.Instances.BEGIN,
            CalendarContract.Instances.END,
            CalendarContract.Instances.ALL_DAY,
            CalendarContract.Instances.DISPLAY_COLOR
        )
    val uri =
        CalendarContract.Instances.CONTENT_URI
            .buildUpon()
            .appendPath(startMillis.toString())
            .appendPath((endMillis - 1).toString())
            .build()
    val calendarPlaceholders = enabledCalendarIds.joinToString(",") { "?" }
    val selection = "${CalendarContract.Instances.CALENDAR_ID} IN ($calendarPlaceholders)"
    return query(
        uri,
        projection,
        selection,
        enabledCalendarIds.toTypedArray(),
        "${CalendarContract.Instances.BEGIN} ASC"
    )?.use { cursor -> cursor.toDeviceCalendarEvents() } ?: emptyList()
}

private fun Cursor.toDeviceCalendarEvents(): List<DeviceCalendarEvent> = buildList {
    val eventIdIndex = getColumnIndexOrThrow(CalendarContract.Instances._ID)
    val calendarIdIndex = getColumnIndexOrThrow(CalendarContract.Instances.CALENDAR_ID)
    val calendarNameIndex = getColumnIndexOrThrow(CalendarContract.Instances.CALENDAR_DISPLAY_NAME)
    val titleIndex = getColumnIndexOrThrow(CalendarContract.Instances.TITLE)
    val descriptionIndex = getColumnIndexOrThrow(CalendarContract.Instances.DESCRIPTION)
    val beginIndex = getColumnIndexOrThrow(CalendarContract.Instances.BEGIN)
    val endIndex = getColumnIndexOrThrow(CalendarContract.Instances.END)
    val allDayIndex = getColumnIndexOrThrow(CalendarContract.Instances.ALL_DAY)
    val colorIndex = getColumnIndexOrThrow(CalendarContract.Instances.DISPLAY_COLOR)
    while (moveToNext()) {
        add(
            DeviceCalendarEvent(
                id = getLong(eventIdIndex).toString(),
                calendarId = getLong(calendarIdIndex).toString(),
                calendarName = getString(calendarNameIndex).orEmpty(),
                title = getString(titleIndex).orEmpty().ifBlank { "(No title)" },
                description = getString(descriptionIndex),
                startsAt = Instant.ofEpochMilli(getLong(beginIndex)),
                endsAt = Instant.ofEpochMilli(getLong(endIndex)),
                allDay = getInt(allDayIndex) == 1,
                color = getInt(colorIndex)
            )
        )
    }
}

data class DeviceCalendar(
    val id: String,
    val name: String,
    val accountName: String?,
    val color: Int,
    val visible: Boolean
)

data class DeviceCalendarEvent(
    val id: String,
    val calendarId: String,
    val calendarName: String,
    val title: String,
    val description: String?,
    val startsAt: Instant,
    val endsAt: Instant,
    val allDay: Boolean,
    val color: Int
)
