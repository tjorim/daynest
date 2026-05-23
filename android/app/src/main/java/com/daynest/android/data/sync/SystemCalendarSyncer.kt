package com.daynest.android.data.sync

import android.Manifest
import android.content.ContentValues
import android.content.Context
import android.content.pm.PackageManager
import android.provider.CalendarContract
import androidx.core.content.ContextCompat
import com.daynest.android.data.today.TodayResponseDto
import dagger.hilt.android.qualifiers.ApplicationContext
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SystemCalendarSyncer
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
    ) {
        fun sync(today: TodayResponseDto) {
            if (!hasCalendarPermissions()) return
            val calendarId = ensureCalendar() ?: return
            val desired = buildEvents(today)
            val existing = loadExistingEvents(calendarId)
            desired.forEach { item ->
                val existingEventId = existing[item.syncKey]
                if (existingEventId != null) {
                    updateEvent(existingEventId, calendarId, item)
                } else {
                    insertEvent(calendarId, item)
                }
            }
            val desiredKeys = desired.map { it.syncKey }.toSet()
            existing.filterKeys { it !in desiredKeys }.values.forEach { eventId ->
                context.contentResolver.delete(
                    CalendarContract.Events.CONTENT_URI,
                    "${CalendarContract.Events._ID}=?",
                    arrayOf(eventId.toString()),
                )
            }
        }

        private fun hasCalendarPermissions(): Boolean =
            ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CALENDAR) == PackageManager.PERMISSION_GRANTED &&
                ContextCompat.checkSelfPermission(context, Manifest.permission.WRITE_CALENDAR) == PackageManager.PERMISSION_GRANTED

        private fun ensureCalendar(): Long? {
            val resolver = context.contentResolver
            resolver.query(
                CalendarContract.Calendars.CONTENT_URI,
                arrayOf(CalendarContract.Calendars._ID),
                "${CalendarContract.Calendars.ACCOUNT_NAME}=? AND " +
                    "${CalendarContract.Calendars.ACCOUNT_TYPE}=? AND " +
                    "${CalendarContract.Calendars.OWNER_ACCOUNT}=? AND " +
                    "${CalendarContract.Calendars.CALENDAR_DISPLAY_NAME}=?",
                arrayOf(
                    DAYNEST_ACCOUNT_NAME,
                    CalendarContract.ACCOUNT_TYPE_LOCAL,
                    DAYNEST_ACCOUNT_NAME,
                    DAYNEST_CALENDAR_DISPLAY_NAME,
                ),
                null,
            )?.use { cursor ->
                if (cursor.moveToFirst()) {
                    return cursor.getLong(0)
                }
            }
            val values =
                ContentValues().apply {
                    put(CalendarContract.Calendars.ACCOUNT_NAME, DAYNEST_ACCOUNT_NAME)
                    put(CalendarContract.Calendars.ACCOUNT_TYPE, CalendarContract.ACCOUNT_TYPE_LOCAL)
                    put(CalendarContract.Calendars.CALENDAR_DISPLAY_NAME, DAYNEST_CALENDAR_DISPLAY_NAME)
                    put(CalendarContract.Calendars.NAME, DAYNEST_CALENDAR_NAME)
                    put(CalendarContract.Calendars.CALENDAR_COLOR, 0xFF5E35B1.toInt())
                    put(CalendarContract.Calendars.CALENDAR_ACCESS_LEVEL, CalendarContract.Calendars.CAL_ACCESS_OWNER)
                    put(CalendarContract.Calendars.OWNER_ACCOUNT, DAYNEST_ACCOUNT_NAME)
                    put(CalendarContract.Calendars.VISIBLE, 1)
                    put(CalendarContract.Calendars.SYNC_EVENTS, 1)
                }
            val uri =
                CalendarContract.Calendars.CONTENT_URI
                    .buildUpon()
                    .appendQueryParameter(CalendarContract.CALLER_IS_SYNCADAPTER, "true")
                    .appendQueryParameter(CalendarContract.Calendars.ACCOUNT_NAME, DAYNEST_ACCOUNT_NAME)
                    .appendQueryParameter(CalendarContract.Calendars.ACCOUNT_TYPE, CalendarContract.ACCOUNT_TYPE_LOCAL)
                    .build()
            return resolver.insert(uri, values)?.lastPathSegment?.toLongOrNull()
        }

        private fun loadExistingEvents(calendarId: Long): Map<String, Long> {
            val map = mutableMapOf<String, Long>()
            context.contentResolver.query(
                CalendarContract.Events.CONTENT_URI,
                arrayOf(CalendarContract.Events._ID, CalendarContract.Events.SYNC_DATA1),
                "${CalendarContract.Events.CALENDAR_ID}=? AND ${CalendarContract.Events.SYNC_DATA1} IS NOT NULL",
                arrayOf(calendarId.toString()),
                null,
            )?.use { cursor ->
                while (cursor.moveToNext()) {
                    val id = cursor.getLong(0)
                    val syncKey = cursor.getString(1) ?: continue
                    map[syncKey] = id
                }
            }
            return map
        }

        private fun insertEvent(
            calendarId: Long,
            event: SyncEvent,
        ) {
            context.contentResolver.insert(
                CalendarContract.Events.CONTENT_URI,
                event.toContentValues(calendarId),
            )
        }

        private fun updateEvent(
            eventId: Long,
            calendarId: Long,
            event: SyncEvent,
        ) {
            context.contentResolver.update(
                CalendarContract.Events.CONTENT_URI,
                event.toContentValues(calendarId),
                "${CalendarContract.Events._ID}=?",
                arrayOf(eventId.toString()),
            )
        }

        private fun buildEvents(today: TodayResponseDto): List<SyncEvent> {
            val zone = ZoneId.systemDefault()
            val events = mutableListOf<SyncEvent>()
            today.dueToday.forEach { item ->
                events += SyncEvent("chore_due_${item.choreInstanceId}", item.title, "${item.scheduledDate}T09:00:00", zone)
            }
            today.overdue.forEach { item ->
                val date = item.overdueSince.ifBlank { LocalDate.now().toString() }
                events += SyncEvent("chore_overdue_${item.choreInstanceId}", item.title, "${date}T09:00:00", zone)
            }
            today.upcoming.forEach { item ->
                events += SyncEvent("chore_upcoming_${item.choreInstanceId}", item.title, "${item.scheduledDate}T09:00:00", zone)
            }
            today.planned.filter { !it.isDone }.forEach { item ->
                events += SyncEvent("planned_${item.id}", item.title, "${item.plannedFor}T09:00:00", zone)
            }
            today.medication.forEach { item ->
                val scheduled = item.scheduledAt.ifBlank { "${LocalDate.now()}T09:00:00Z" }
                events += SyncEvent("medication_${item.medicationDoseInstanceId}", item.name, scheduled, zone)
            }
            return events
        }
    }

private data class SyncEvent(
    val syncKey: String,
    val title: String,
    val startsAt: String,
    val zone: ZoneId,
) {
    fun toContentValues(calendarId: Long): ContentValues {
        val dtStart =
            runCatching {
                Instant.parse(startsAt).toEpochMilli()
            }.getOrElse {
                LocalDateTime
                    .parse(startsAt, DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                    .atZone(zone)
                    .toInstant()
                    .toEpochMilli()
            }
        val dtEnd = dtStart + 60 * 60 * 1000L
        return ContentValues().apply {
            put(CalendarContract.Events.CALENDAR_ID, calendarId)
            put(CalendarContract.Events.TITLE, title)
            put(CalendarContract.Events.DESCRIPTION, "Synced by Daynest")
            put(CalendarContract.Events.DTSTART, dtStart)
            put(CalendarContract.Events.DTEND, dtEnd)
            put(CalendarContract.Events.EVENT_TIMEZONE, zone.id)
            put(CalendarContract.Events.SYNC_DATA1, syncKey)
        }
    }
}

private const val DAYNEST_ACCOUNT_NAME = "daynest.local"
private const val DAYNEST_CALENDAR_DISPLAY_NAME = "Daynest"
private const val DAYNEST_CALENDAR_NAME = "daynest"
