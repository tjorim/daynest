package com.daynest.android.feature.stats

import com.daynest.android.data.analytics.AnalyticsApi
import com.daynest.android.data.analytics.AnalyticsRepository
import com.daynest.android.data.analytics.AnalyticsSummaryDto
import com.daynest.android.data.analytics.ChoreStatsDto
import com.daynest.android.data.analytics.MedicationStatsDto
import com.daynest.android.data.analytics.PlannedItemStatsDto
import com.daynest.android.data.analytics.RoutineStatsDto
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class StatsViewModelTest {
    private val dispatcher = StandardTestDispatcher()

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `initial load requests week summary`() = runTest {
        val api = FakeAnalyticsApi()
        val viewModel = StatsViewModel(AnalyticsRepository(api))

        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state is StatsUiState.Content)
        assertEquals(StatsPeriod.WEEK, (state as StatsUiState.Content).period)
        assertEquals(listOf("week"), api.periods)
    }

    @Test
    fun `period selection reloads requested summary`() = runTest {
        val api = FakeAnalyticsApi()
        val viewModel = StatsViewModel(AnalyticsRepository(api))
        advanceUntilIdle()

        viewModel.onEvent(StatsUiEvent.PeriodSelected(StatsPeriod.MONTH))
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state is StatsUiState.Content)
        assertEquals(StatsPeriod.MONTH, (state as StatsUiState.Content).period)
        assertEquals(listOf("week", "month"), api.periods)
    }

    @Test
    fun `failure publishes error state`() = runTest {
        val viewModel = StatsViewModel(AnalyticsRepository(FakeAnalyticsApi(error = IllegalStateException("boom"))))

        advanceUntilIdle()

        assertEquals(StatsUiState.Error, viewModel.uiState.value)
    }

    @Test
    fun `retry from content preserves selected period`() = runTest {
        val api = FakeAnalyticsApi()
        val viewModel = StatsViewModel(AnalyticsRepository(api))
        advanceUntilIdle()
        viewModel.onEvent(StatsUiEvent.PeriodSelected(StatsPeriod.YEAR))
        advanceUntilIdle()

        viewModel.onEvent(StatsUiEvent.RetryClicked)
        advanceUntilIdle()

        assertEquals(listOf("week", "year", "year"), api.periods)
    }
}

private class FakeAnalyticsApi(private val error: Throwable? = null) : AnalyticsApi {
    val periods = mutableListOf<String>()

    override suspend fun getSummary(period: String): AnalyticsSummaryDto {
        periods += period
        error?.let { throw it }
        return summary(period)
    }
}

private fun summary(period: String) = AnalyticsSummaryDto(
    period = period,
    startDate = "2026-07-01",
    endDate = "2026-07-07",
    chores =
    ChoreStatsDto(
        completionRate = 1.0,
        totalCompleted = 1,
        totalScheduled = 1,
        dailyCompletions = emptyList(),
        streaks = emptyList(),
        mostSkipped = emptyList()
    ),
    medications =
    MedicationStatsDto(
        adherenceRate = 1.0,
        totalTaken = 1,
        totalScheduled = 1,
        dailyAdherence = emptyList()
    ),
    plannedItems =
    PlannedItemStatsDto(
        completionRate = 1.0,
        totalCompleted = 1,
        totalScheduled = 1,
        dailyCompletions = emptyList()
    ),
    routines =
    RoutineStatsDto(
        completionRate = 1.0,
        totalCompleted = 1,
        totalScheduled = 1,
        dailyCompletions = emptyList(),
        streaks = emptyList()
    )
)
