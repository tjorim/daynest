package com.daynest.android.data.calendar

import com.daynest.android.data.safeApiCall
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class CalendarRepository
@Inject
constructor(private val calendarApi: CalendarApi) {
    suspend fun getMonth(year: Int, month: Int): Result<CalendarMonthDto> =
        safeApiCall { calendarApi.getMonth(year, month) }

    suspend fun getDay(date: String): Result<CalendarDayDto> = safeApiCall { calendarApi.getDay(date) }
}
