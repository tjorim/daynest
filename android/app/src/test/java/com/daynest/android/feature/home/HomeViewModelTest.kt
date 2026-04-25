package com.daynest.android.feature.home

import com.daynest.android.data.today.DueTodayItemDto
import com.daynest.android.data.today.MedicationHistoryItemDto
import com.daynest.android.data.today.MedicationTodayItemDto
import com.daynest.android.data.today.OverdueTodayItemDto
import com.daynest.android.data.today.PlannedTodayItemDto
import com.daynest.android.data.today.RoutineTodayItemDto
import com.daynest.android.data.today.TodayApi
import com.daynest.android.data.today.TodayRepository
import com.daynest.android.data.today.TodayResponseDto
import com.daynest.android.data.today.UpcomingTodayItemDto
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
class HomeViewModelTest {
    private val dispatcher = StandardTestDispatcher()

    @Before
    fun setup() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `state emits success when repository returns today data`() = runTest {
        val viewModel = HomeViewModel(
            repository = TodayRepository(
                todayApi = FakeTodayApi(
                    response = TodayResponseDto(
                        medication = listOf(MedicationTodayItemDto(1, "Vitamin D")),
                        medicationHistory = listOf(MedicationHistoryItemDto(2, "Omega-3")),
                        routines = listOf(RoutineTodayItemDto(3, "Walk the dog")),
                        overdue = listOf(OverdueTodayItemDto(4, "Trash out")),
                        dueToday = listOf(DueTodayItemDto(5, "Laundry")),
                        upcoming = listOf(UpcomingTodayItemDto(6, "Plant watering")),
                        planned = listOf(
                            PlannedTodayItemDto(7, "Buy groceries", isDone = false),
                            PlannedTodayItemDto(8, "Call insurance", isDone = true),
                        ),
                    ),
                ),
            ),
        )

        advanceUntilIdle()

        val state = viewModel.state.value

        assertTrue(state is HomeUiState.Success)
        val success = state as HomeUiState.Success
        assertEquals(5, success.summary.remainingCount)
        assertTrue(!success.summary.isCaughtUp)
    }

    @Test
    fun `state emits error when repository request fails`() = runTest {
        val viewModel = HomeViewModel(
            repository = TodayRepository(todayApi = FakeTodayApi(error = IllegalStateException("boom"))),
        )

        advanceUntilIdle()

        val state = viewModel.state.value

        assertTrue(state is HomeUiState.Error)
        assertEquals("boom", (state as HomeUiState.Error).message)
    }
}

private class FakeTodayApi(
    private val response: TodayResponseDto? = null,
    private val error: Throwable? = null,
) : TodayApi {
    override suspend fun getToday(): TodayResponseDto {
        error?.let { throw it }
        return checkNotNull(response)
    }
}
