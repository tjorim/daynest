package com.daynest.android.data.analytics

import com.daynest.android.data.safeApiCall
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AnalyticsRepository
@Inject
constructor(private val analyticsApi: AnalyticsApi) {
    suspend fun getSummary(period: String): Result<AnalyticsSummaryDto> =
        safeApiCall { analyticsApi.getSummary(period) }
}
