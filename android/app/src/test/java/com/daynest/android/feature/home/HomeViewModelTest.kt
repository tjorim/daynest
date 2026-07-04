package com.daynest.android.feature.home

import com.daynest.android.core.database.sync.CacheEntryDao
import com.daynest.android.core.database.sync.CacheEntryEntity
import com.daynest.android.core.database.sync.PendingMutationDao
import com.daynest.android.core.database.sync.PendingMutationEntity
import com.daynest.android.core.database.today.TodaySummaryDao
import com.daynest.android.core.database.today.TodaySummaryEntity
import com.daynest.android.data.today.ChoreMutationDto
import com.daynest.android.data.today.DeleteScope
import com.daynest.android.data.today.DoseMutationDto
import com.daynest.android.data.today.DueTodayItemDto
import com.daynest.android.data.today.EditScope
import com.daynest.android.data.today.MedicationHistoryItemDto
import com.daynest.android.data.today.MedicationTodayItemDto
import com.daynest.android.data.today.OverdueTodayItemDto
import com.daynest.android.data.today.PlannedItemApi
import com.daynest.android.data.today.PlannedItemCreateDto
import com.daynest.android.data.today.PlannedItemRepository
import com.daynest.android.data.today.PlannedItemUpdateDto
import com.daynest.android.data.today.PlannedTodayItemDto
import com.daynest.android.data.today.RescheduleChoreDto
import com.daynest.android.data.today.RoutineTodayItemDto
import com.daynest.android.data.today.TaskMutationDto
import com.daynest.android.data.today.TodayActionsApi
import com.daynest.android.data.today.TodayApi
import com.daynest.android.data.today.TodayRepository
import com.daynest.android.data.today.TodayResponseDto
import com.daynest.android.data.today.UpcomingTodayItemDto
import com.daynest.android.fakes.StubTodayActionsApi
import kotlin.collections.ArrayDeque
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
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
        val viewModel =
            HomeViewModel(
                repository =
                TodayRepository(
                    todayApi =
                    FakeTodayApi().apply {
                        enqueueSuccess(todayResponse())
                    },
                    todayActionsApi = StubTodayActionsApi(),
                    todaySummaryDao = FakeTodaySummaryDao(),
                    cacheEntryDao = FakeCacheEntryDao(),
                    pendingMutationDao = FakePendingMutationDao()
                ),
                plannedItemRepository =
                PlannedItemRepository(
                    plannedItemApi = StubPlannedItemApi(),
                    cacheEntryDao = FakeCacheEntryDao(),
                    pendingMutationDao = FakePendingMutationDao()
                )
            )

        advanceUntilIdle()

        val state = viewModel.uiState.value

        assertTrue(state is HomeUiState.Content)
        val content = state as HomeUiState.Content
        assertEquals(5, content.summary.remainingCount)
        assertFalse(content.isStale)
        assertTrue(!content.summary.isCaughtUp)
    }

    @Test
    fun `state emits error when repository request fails`() = runTest {
        val viewModel =
            HomeViewModel(
                repository =
                TodayRepository(
                    todayApi =
                    FakeTodayApi().apply {
                        enqueueError(IllegalStateException("boom"))
                    },
                    todayActionsApi = StubTodayActionsApi(),
                    todaySummaryDao = FakeTodaySummaryDao(),
                    cacheEntryDao = FakeCacheEntryDao(),
                    pendingMutationDao = FakePendingMutationDao()
                ),
                plannedItemRepository =
                PlannedItemRepository(
                    plannedItemApi = StubPlannedItemApi(),
                    cacheEntryDao = FakeCacheEntryDao(),
                    pendingMutationDao = FakePendingMutationDao()
                )
            )

        advanceUntilIdle()

        val state = viewModel.uiState.value

        assertTrue(state is HomeUiState.Error)
        assertEquals(HomeError.LoadTodayFailed, (state as HomeUiState.Error).error)
    }

    @Test
    fun `retry transitions from error to loading to content`() = runTest {
        val loadGate = CompletableDeferred<Unit>()
        val api =
            FakeTodayApi().apply {
                enqueueError(IllegalStateException("initial load failure"))
                enqueueSuccess(todayResponse(), gate = loadGate)
            }
        val repository =
            TodayRepository(
                todayApi = api,
                todayActionsApi = StubTodayActionsApi(),
                todaySummaryDao = FakeTodaySummaryDao(),
                cacheEntryDao = FakeCacheEntryDao(),
                pendingMutationDao = FakePendingMutationDao()
            )
        val viewModel =
            HomeViewModel(
                repository = repository,
                plannedItemRepository =
                PlannedItemRepository(
                    plannedItemApi = StubPlannedItemApi(),
                    cacheEntryDao = FakeCacheEntryDao(),
                    pendingMutationDao = FakePendingMutationDao()
                )
            )

        advanceUntilIdle()
        assertTrue(viewModel.uiState.value is HomeUiState.Error)

        viewModel.onEvent(HomeUiEvent.RetryClicked)
        runCurrent()

        assertEquals(HomeUiState.Loading, viewModel.uiState.value)

        loadGate.complete(Unit)
        advanceUntilIdle()

        assertTrue(viewModel.uiState.value is HomeUiState.Content)
    }

    @Test
    fun `state shows stale content when refresh fails but cache exists`() = runTest {
        val dao = FakeTodaySummaryDao()
        val api =
            FakeTodayApi().apply {
                enqueueSuccess(todayResponse())
                enqueueError(IllegalStateException("network gone"))
            }
        val viewModel =
            HomeViewModel(
                repository =
                TodayRepository(
                    todayApi = api,
                    todayActionsApi = StubTodayActionsApi(),
                    todaySummaryDao = dao,
                    cacheEntryDao = FakeCacheEntryDao(),
                    pendingMutationDao = FakePendingMutationDao()
                ),
                plannedItemRepository =
                PlannedItemRepository(
                    plannedItemApi = StubPlannedItemApi(),
                    cacheEntryDao = FakeCacheEntryDao(),
                    pendingMutationDao = FakePendingMutationDao()
                )
            )

        advanceUntilIdle()
        assertTrue(viewModel.uiState.value is HomeUiState.Content)
        assertFalse((viewModel.uiState.value as HomeUiState.Content).isStale)

        viewModel.onEvent(HomeUiEvent.RetryClicked)
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state is HomeUiState.Content)
        assertTrue((state as HomeUiState.Content).isStale)
    }
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

    override suspend fun updateAttempts(id: Long, attempts: Int) {
        entries.replaceAll { entry -> if (entry.id == id) entry.copy(attempts = attempts) else entry }
    }

    override suspend fun markRemoteApplied(id: Long, appliedAtEpochMillis: Long) {
        entries.replaceAll { entry ->
            if (entry.id == id) entry.copy(remoteAppliedAtEpochMillis = appliedAtEpochMillis) else entry
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
    private val requests: ArrayDeque<FakeResponse> = ArrayDeque()

    fun enqueueSuccess(response: TodayResponseDto, gate: CompletableDeferred<Unit>? = null) {
        requests.addLast(FakeResponse.Success(response = response, gate = gate))
    }

    fun enqueueError(error: Throwable, gate: CompletableDeferred<Unit>? = null) {
        requests.addLast(FakeResponse.Error(error = error, gate = gate))
    }

    override suspend fun getToday(): TodayResponseDto {
        val response =
            checkNotNull(requests.removeFirstOrNull()) {
                "No queued response for FakeTodayApi"
            }

        response.gate?.await()

        return when (response) {
            is FakeResponse.Success -> response.response
            is FakeResponse.Error -> throw response.error
        }
    }
}

private sealed interface FakeResponse {
    val gate: CompletableDeferred<Unit>?

    data class Success(val response: TodayResponseDto, override val gate: CompletableDeferred<Unit>? = null) :
        FakeResponse

    data class Error(val error: Throwable, override val gate: CompletableDeferred<Unit>? = null) : FakeResponse
}

private fun todayResponse() = TodayResponseDto(
    medication = listOf(MedicationTodayItemDto(1, "Vitamin D")),
    medicationHistory = listOf(MedicationHistoryItemDto(2, "Omega-3")),
    routines = listOf(RoutineTodayItemDto(3, "Walk the dog")),
    overdue = listOf(OverdueTodayItemDto(4, "Trash out")),
    dueToday = listOf(DueTodayItemDto(5, "Laundry")),
    upcoming = listOf(UpcomingTodayItemDto(6, "Plant watering")),
    planned =
    listOf(
        PlannedTodayItemDto(7, "Buy groceries", isDone = false),
        PlannedTodayItemDto(8, "Call insurance", isDone = true)
    )
)

private class StubTodayActionsApi : TodayActionsApi {
    override suspend fun completeChore(id: Int): ChoreMutationDto = ChoreMutationDto(id, "completed")

    override suspend fun skipChore(id: Int): ChoreMutationDto = ChoreMutationDto(id, "skipped")

    override suspend fun rescheduleChore(id: Int, request: RescheduleChoreDto): ChoreMutationDto =
        ChoreMutationDto(id, "pending")

    override suspend fun completeTask(id: Int): TaskMutationDto = TaskMutationDto(id, "completed")

    override suspend fun skipTask(id: Int): TaskMutationDto = TaskMutationDto(id, "skipped")

    override suspend fun startTask(id: Int): TaskMutationDto = TaskMutationDto(id, "in_progress")

    override suspend fun takeDose(id: Int): DoseMutationDto = DoseMutationDto(id, "taken")

    override suspend fun skipDose(id: Int): DoseMutationDto = DoseMutationDto(id, "skipped")
}

private class StubPlannedItemApi : PlannedItemApi {
    override suspend fun updatePlannedItem(
        id: Int,
        request: PlannedItemUpdateDto,
        scope: EditScope
    ): PlannedTodayItemDto = PlannedTodayItemDto(id, request.title, request.isDone)

    override suspend fun deletePlannedItem(id: Int, scope: DeleteScope) = Unit

    override suspend fun createPlannedItem(request: PlannedItemCreateDto): PlannedTodayItemDto =
        PlannedTodayItemDto(0, request.title, false)

    override suspend fun listPlannedItems(startDate: String?, endDate: String?): List<PlannedTodayItemDto> = emptyList()
}
