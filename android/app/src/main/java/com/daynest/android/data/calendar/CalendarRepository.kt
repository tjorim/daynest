package com.daynest.android.data.calendar

import kotlinx.coroutines.CancellationException
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class CalendarRepository
    @Inject
    constructor(
        private val calendarApi: CalendarApi,
    ) {
        @Suppress("TooGenericExceptionCaught")
        suspend fun getMonth(
            year: Int,
            month: Int,
        ): Result<CalendarMonthDto> =
            try {
                Result.success(calendarApi.getMonth(year, month))
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                Result.failure(e)
            }

        @Suppress("TooGenericExceptionCaught")
        suspend fun getDay(date: String): Result<CalendarDayDto> =
            try {
                Result.success(calendarApi.getDay(date))
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                Result.failure(e)
            }
    }
