package com.daynest.android.data.today

import app.cash.turbine.test
import com.daynest.android.core.database.sync.CacheEntryDao
import com.daynest.android.core.database.sync.CacheEntryEntity
import com.daynest.android.core.database.sync.PendingMutationDao
import com.daynest.android.core.database.sync.PendingMutationEntity
import com.daynest.android.core.database.today.TodaySummaryDao
import com.daynest.android.core.database.today.TodaySummaryEntity
import com.daynest.android.fakes.StubTodayActionsApi
import java.io.IOException
import kotlin.collections.ArrayDeque
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

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
            val repository =
                TodayRepository(
                    todayApi = api,
                    todayActionsApi = StubTodayActionsApi(),
                    todaySummaryDao = dao,
                    cacheEntryDao = FakeCacheEntryDao(),
                    pendingMutationDao = FakePendingMutationDao(),
                    appContext = null,
                )

            repository.observeTodaySummary().test {
                assertNull(awaitItem())
                assertTrue(repository.refresh().isSuccess)
                val summary = awaitItem()
                assertNotNull(summary)
                assertEquals(1, summary!!.routinesCount)
                assertEquals(2, summary.choresCount)
                assertEquals(1, summary.medicationsCount)
                assertEquals(1, summary.plannedPendingCount)
                assertEquals(5, summary.remainingCount)
                cancelAndIgnoreRemainingEvents()
            }
        }

    @Test
    fun `offline mutation is queued and returned as queued status`() =
        runTest {
            val queuedDao = FakePendingMutationDao()
            val repository =
                TodayRepository(
                    todayApi = FakeTodayApi(),
                    todayActionsApi =
                        object : TodayActionsApi by StubTodayActionsApi() {
                            override suspend fun completeChore(id: Int): ChoreMutationDto = throw IOException("offline")
                        },
                    todaySummaryDao = FakeTodaySummaryDao(),
                    cacheEntryDao = FakeCacheEntryDao(),
                    pendingMutationDao = queuedDao,
                    appContext = null,
                )

            val result = repository.completeChore(99)
            assertTrue(result.isSuccess)
            assertEquals("queued", result.getOrThrow().status)
            assertEquals(1, queuedDao.listAll().size)
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

    override suspend fun getToday(): TodayResponseDto {
        val response = checkNotNull(requests.removeFirstOrNull()) { "No queued response for FakeTodayApi" }
        return when (response) {
            is FakeApiResponse.Success -> response.response
        }
    }
}

private sealed interface FakeApiResponse {
    data class Success(
        val response: TodayResponseDto,
    ) : FakeApiResponse
}

private class FakeCacheEntryDao : CacheEntryDao {
    private val state = MutableStateFlow<Map<String, CacheEntryEntity>>(emptyMap())

    override fun observe(cacheKey: String): Flow<CacheEntryEntity?> = state.map { it[cacheKey] }

    override suspend fun get(cacheKey: String): CacheEntryEntity? = state.value[cacheKey]

    override suspend fun upsert(entry: CacheEntryEntity) {
        state.value = state.value + (entry.cacheKey to entry)
    }
}

private class FakePendingMutationDao : PendingMutationDao {
    private val entries = mutableListOf<PendingMutationEntity>()
    private val count = MutableStateFlow(0)

    override fun observeCount(): Flow<Int> = count

    override suspend fun listAll(): List<PendingMutationEntity> = entries.toList()

    override suspend fun enqueue(entity: PendingMutationEntity) {
        entries += entity.copy(id = entries.size + 1L)
        count.value = entries.size
    }

    override suspend fun delete(id: Long) {
        entries.removeAll { it.id == id }
        count.value = entries.size
    }

    override suspend fun updateAttempts(
        id: Long,
        attempts: Int,
    ) {
        entries.replaceAll { entry -> if (entry.id == id) entry.copy(attempts = attempts) else entry }
    }

    override suspend fun markRemoteApplied(
        id: Long,
        appliedAtEpochMillis: Long,
    ) {
        entries.replaceAll { entry ->
            if (entry.id == id) {
                entry.copy(remoteAppliedAtEpochMillis = appliedAtEpochMillis)
            } else {
                entry
            }
        }
    }
}
