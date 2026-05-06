package com.daynest.android.data.today

import app.cash.turbine.test
import com.daynest.android.core.database.today.TodaySummaryDao
import com.daynest.android.core.database.today.TodaySummaryEntity
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.collections.ArrayDeque

@OptIn(ExperimentalCoroutinesApi::class)
class TodayRepositoryTest {
    @Test
    fun `network success - entity upserted and flow emits domain model`() =
        runTest {
            val dao = FakeTodaySummaryDao()
            val api =
                FakeTodayApi().apply {
                    enqueueSuccess(
                        TodayResponseDto(
                            routines = listOf(RoutineTodayItemDto(1, "Morning walk")),
                            dueToday = listOf(DueTodayItemDto(2, "Dishes")),
                            overdue = listOf(OverdueTodayItemDto(3, "Laundry")),
                            medication = listOf(MedicationTodayItemDto(4, "Vitamin D")),
                            planned =
                                listOf(
                                    PlannedTodayItemDto(5, "Call doctor", isDone = false),
                                    PlannedTodayItemDto(6, "Buy groceries", isDone = true),
                                ),
                        ),
                    )
                }
            val repository = TodayRepository(todayApi = api, todaySummaryDao = dao)

            repository.observeTodaySummary().test {
                assertNull(awaitItem())

                val result = repository.refresh()
                assertTrue(result.isSuccess)

                val summary = awaitItem()
                assertNotNull(summary)
                assertEquals(1, summary!!.routinesCount)
                assertEquals(2, summary.choresCount) // dueToday(1) + overdue(1)
                assertEquals(1, summary.medicationsCount)
                assertEquals(1, summary.plannedPendingCount) // only isDone=false
                assertEquals(5, summary.remainingCount)

                cancelAndIgnoreRemainingEvents()
            }
        }

    @Test
    fun `network failure with cached entity - flow emits cache and refresh returns failure`() =
        runTest {
            val dao =
                FakeTodaySummaryDao().apply {
                    upsert(
                        TodaySummaryEntity(
                            id = 0,
                            routinesCount = 2,
                            choresCount = 3,
                            medicationsCount = 1,
                            plannedPendingCount = 4,
                            lastFetchedEpochMillis = 1_000L,
                        ),
                    )
                }
            val api =
                FakeTodayApi().apply {
                    enqueueError(RuntimeException("network unavailable"))
                }
            val repository = TodayRepository(todayApi = api, todaySummaryDao = dao)

            repository.observeTodaySummary().test {
                val cached = awaitItem()
                assertNotNull(cached)
                assertEquals(2, cached!!.routinesCount)

                val result = repository.refresh()
                assertTrue(result.isFailure)

                expectNoEvents()
                cancelAndIgnoreRemainingEvents()
            }
        }

    @Test
    fun `empty cache and network failure - flow emits null`() =
        runTest {
            val dao = FakeTodaySummaryDao()
            val api =
                FakeTodayApi().apply {
                    enqueueError(RuntimeException("no connection"))
                }
            val repository = TodayRepository(todayApi = api, todaySummaryDao = dao)

            repository.observeTodaySummary().test {
                assertNull(awaitItem())

                val result = repository.refresh()
                assertTrue(result.isFailure)

                expectNoEvents()
                cancelAndIgnoreRemainingEvents()
            }
        }
}

private class FakeTodaySummaryDao : TodaySummaryDao {
    private val flow = MutableStateFlow<TodaySummaryEntity?>(null)

    override fun observe(): Flow<TodaySummaryEntity?> = flow

    override suspend fun upsert(entity: TodaySummaryEntity) {
        flow.value = entity
    }

    override suspend fun clear() {
        flow.value = null
    }
}

private class FakeTodayApi : TodayApi {
    private val requests: ArrayDeque<FakeApiResponse> = ArrayDeque()

    fun enqueueSuccess(response: TodayResponseDto) {
        requests.addLast(FakeApiResponse.Success(response))
    }

    fun enqueueError(error: Throwable) {
        requests.addLast(FakeApiResponse.Error(error))
    }

    override suspend fun getToday(): TodayResponseDto {
        val response =
            checkNotNull(requests.removeFirstOrNull()) {
                "No queued response for FakeTodayApi"
            }
        return when (response) {
            is FakeApiResponse.Success -> response.response
            is FakeApiResponse.Error -> throw response.error
        }
    }
}

private sealed interface FakeApiResponse {
    data class Success(
        val response: TodayResponseDto,
    ) : FakeApiResponse

    data class Error(
        val error: Throwable,
    ) : FakeApiResponse
}
