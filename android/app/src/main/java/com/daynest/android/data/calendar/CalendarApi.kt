package com.daynest.android.data.calendar

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import retrofit2.http.GET
import retrofit2.http.Query

interface CalendarApi {
    @GET("api/v1/calendar/month")
    suspend fun getMonth(
        @Query("year") year: Int,
        @Query("month") month: Int,
    ): CalendarMonthDto

    @GET("api/v1/calendar/day")
    suspend fun getDay(
        @Query("date") date: String,
    ): CalendarDayDto
}

@Serializable
data class CalendarMonthDto(
    val year: Int,
    val month: Int,
    val days: List<CalendarDaySummaryDto>,
)

@Serializable
data class CalendarDaySummaryDto(
    val date: String,
    val total: Int,
    val routines: Int,
    val chores: Int,
    val medications: Int,
    val planned: Int,
)

@Serializable
data class CalendarDayDto(
    val date: String,
    val items: List<UnifiedDayItemDto>,
)

@Serializable
data class UnifiedDayItemDto(
    @SerialName("item_type")
    val itemType: String,
    @SerialName("item_id")
    val itemId: Int,
    val title: String,
    val status: String,
    @SerialName("scheduled_at")
    val scheduledAt: String? = null,
    @SerialName("scheduled_date")
    val scheduledDate: String? = null,
    val detail: String? = null,
    @SerialName("module_key")
    val moduleKey: String? = null,
    val rrule: String? = null,
    @SerialName("recurrence_series_id")
    val recurrenceSeriesId: String? = null,
    @SerialName("recurrence_hint")
    val recurrenceHint: String? = null,
    @SerialName("linked_source")
    val linkedSource: String? = null,
    @SerialName("linked_ref")
    val linkedRef: String? = null,
)
