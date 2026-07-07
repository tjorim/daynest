package com.daynest.android.feature.shopping

import android.app.Application
import com.daynest.android.R
import com.daynest.android.core.database.sync.CacheEntryDao
import com.daynest.android.core.database.sync.CacheEntryEntity
import com.daynest.android.core.database.sync.PendingMutationDao
import com.daynest.android.core.database.sync.PendingMutationEntity
import com.daynest.android.data.shopping.ShoppingListApi
import com.daynest.android.data.shopping.ShoppingListCreateDto
import com.daynest.android.data.shopping.ShoppingListDto
import com.daynest.android.data.shopping.ShoppingListRepository
import com.daynest.android.data.shopping.ShoppingListStatus
import com.daynest.android.data.shopping.ShoppingListUpdateDto
import com.daynest.android.data.today.DeleteScope
import com.daynest.android.data.today.EditScope
import com.daynest.android.data.today.PlannedItemApi
import com.daynest.android.data.today.PlannedItemCreateDto
import com.daynest.android.data.today.PlannedItemRepository
import com.daynest.android.data.today.PlannedItemUpdateDto
import com.daynest.android.data.today.PlannedTodayItemDto
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class RecurringGroceriesViewModelTest {
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
    fun `refresh groups recurring grocery series by earliest occurrence`() = runTest {
        val plannedApi =
            FakePlannedItemApi(
                plannedItems =
                listOf(
                    recurringItem(id = 2, title = "Milk", plannedFor = "2026-07-10", seriesId = "series-1"),
                    recurringItem(id = 1, title = "Milk", plannedFor = "2026-07-03", seriesId = "series-1"),
                    recurringItem(id = 3, title = "Bread", plannedFor = "2026-07-04", seriesId = "series-2"),
                    PlannedTodayItemDto(id = 4, title = "One-off", isDone = false, plannedFor = "2026-07-05")
                )
            )
        val viewModel = viewModel(plannedApi = plannedApi)

        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertFalse(state.isLoading)
        assertNull(state.error)
        assertEquals(listOf("Bread", "Milk"), state.series.map { it.title })
        assertEquals(1, state.series.first { it.title == "Milk" }.representativeId)
    }

    @Test
    fun `create preserves recurrence and shopping list fields`() = runTest {
        val plannedApi = FakePlannedItemApi()
        val viewModel = viewModel(plannedApi = plannedApi)
        advanceUntilIdle()

        viewModel.save(
            input =
            RecurringGroceryInput(
                title = "  Coffee  ",
                startDate = "2026-07-08",
                notes = "Beans",
                rrule = "FREQ=WEEKLY",
                recurrenceHint = "Weekly",
                autoAddToListId = 7,
                tags = listOf("pantry")
            ),
            editing = null
        )
        advanceUntilIdle()

        val request = plannedApi.createdRequests.single()
        assertEquals("Coffee", request.title)
        assertEquals("2026-07-08", request.plannedFor)
        assertEquals("recurring_grocery", request.moduleKey)
        assertEquals("FREQ=WEEKLY", request.rrule)
        assertEquals("Weekly", request.recurrenceHint)
        assertEquals("7", request.linkedRef)
        assertEquals(7, request.autoAddToListId)
        assertEquals(listOf("pantry"), request.tags)
        assertTrue(viewModel.uiState.value.series.any { it.title == "Coffee" })
    }

    @Test
    fun `edit updates all future instances and preserves payload fields`() = runTest {
        val plannedApi = FakePlannedItemApi()
        val viewModel = viewModel(plannedApi = plannedApi)
        advanceUntilIdle()
        val editing =
            RecurringGrocerySeries(
                key = "series-1",
                representativeId = 42,
                title = "Coffee",
                startDate = "2026-07-01",
                notes = null,
                rrule = "FREQ=WEEKLY",
                recurrenceHint = null,
                autoAddToListId = null,
                tags = emptyList()
            )

        viewModel.save(
            input =
            RecurringGroceryInput(
                title = "Coffee beans",
                startDate = "2026-07-08",
                notes = "Dark roast",
                rrule = "FREQ=MONTHLY",
                recurrenceHint = "Monthly",
                autoAddToListId = 9,
                tags = listOf("bulk")
            ),
            editing = editing
        )
        advanceUntilIdle()

        assertEquals(42, plannedApi.updatedId)
        assertEquals(EditScope.ALL, plannedApi.updatedScope)
        val request = checkNotNull(plannedApi.updatedRequest)
        assertEquals("Coffee beans", request.title)
        assertEquals("FREQ=MONTHLY", request.rrule)
        assertEquals("recurring_grocery", request.linkedSource)
        assertEquals("9", request.linkedRef)
        assertEquals(9, request.autoAddToListId)
        assertEquals(listOf("bulk"), request.tags)
    }

    @Test
    fun `delete removes future series from state`() = runTest {
        val plannedApi =
            FakePlannedItemApi(
                plannedItems =
                listOf(
                    recurringItem(id = 5, title = "Milk", plannedFor = "2026-07-03", seriesId = "s")
                )
            )
        val viewModel = viewModel(plannedApi = plannedApi)
        advanceUntilIdle()
        val series = viewModel.uiState.value.series.single()

        viewModel.delete(series)
        advanceUntilIdle()

        assertEquals(5, plannedApi.deletedId)
        assertEquals(DeleteScope.FUTURE, plannedApi.deletedScope)
        assertTrue(viewModel.uiState.value.series.isEmpty())
    }
}

private fun viewModel(plannedApi: FakePlannedItemApi = FakePlannedItemApi()): RecurringGroceriesViewModel {
    val cacheEntryDao = FakeCacheEntryDao()
    val pendingMutationDao = FakePendingMutationDao()
    return RecurringGroceriesViewModel(
        application = fakeApplication(),
        plannedItemRepository =
        PlannedItemRepository(
            plannedItemApi = plannedApi,
            cacheEntryDao = cacheEntryDao,
            pendingMutationDao = pendingMutationDao
        ),
        shoppingListRepository =
        ShoppingListRepository(
            shoppingListApi = FakeShoppingListApi(),
            cacheEntryDao = cacheEntryDao,
            pendingMutationDao = pendingMutationDao,
            appContext = mockk(relaxed = true)
        )
    )
}

private fun fakeApplication(): Application = mockk {
    every { getString(any()) } answers {
        when (firstArg<Int>()) {
            R.string.shopping_recurring_saved -> "Saved"
            R.string.shopping_error_add_recurring_item -> "Unable to save recurring item"
            R.string.shopping_error_delete_recurring_item -> "Unable to delete recurring item"
            else -> "message"
        }
    }
}

private class FakePlannedItemApi(
    private val plannedItems: List<PlannedTodayItemDto> = emptyList(),
    private val error: Throwable? = null
) : PlannedItemApi {
    val createdRequests = mutableListOf<PlannedItemCreateDto>()
    var updatedId: Int? = null
        private set
    var updatedRequest: PlannedItemUpdateDto? = null
        private set
    var updatedScope: EditScope? = null
        private set
    var deletedId: Int? = null
        private set
    var deletedScope: DeleteScope? = null
        private set

    override suspend fun updatePlannedItem(
        id: Int,
        request: PlannedItemUpdateDto,
        scope: EditScope
    ): PlannedTodayItemDto {
        error?.let { throw it }
        updatedId = id
        updatedRequest = request
        updatedScope = scope
        return PlannedTodayItemDto(
            id = id,
            title = request.title,
            isDone = request.isDone,
            plannedFor = request.plannedFor,
            notes = request.notes,
            moduleKey = request.moduleKey,
            rrule = request.rrule,
            recurrenceHint = request.recurrenceHint,
            linkedSource = request.linkedSource,
            linkedRef = request.linkedRef,
            autoAddToListId = request.autoAddToListId,
            tags = request.tags
        )
    }

    override suspend fun deletePlannedItem(id: Int, scope: DeleteScope) {
        error?.let { throw it }
        deletedId = id
        deletedScope = scope
    }

    override suspend fun createPlannedItem(request: PlannedItemCreateDto): PlannedTodayItemDto {
        error?.let { throw it }
        createdRequests += request
        return PlannedTodayItemDto(
            id = 100,
            title = request.title,
            isDone = false,
            plannedFor = request.plannedFor,
            notes = request.notes,
            moduleKey = request.moduleKey,
            rrule = request.rrule,
            recurrenceHint = request.recurrenceHint,
            linkedSource = request.linkedSource,
            linkedRef = request.linkedRef,
            autoAddToListId = request.autoAddToListId,
            tags = request.tags
        )
    }

    override suspend fun listPlannedItems(startDate: String?, endDate: String?): List<PlannedTodayItemDto> {
        error?.let { throw it }
        return plannedItems
    }
}

private class FakeShoppingListApi : ShoppingListApi {
    override suspend fun listShoppingLists(status: String): List<ShoppingListDto> =
        listOf(ShoppingListDto(id = 7, userId = 1, name = "Groceries", status = ShoppingListStatus.ACTIVE))

    override suspend fun createShoppingList(request: ShoppingListCreateDto): ShoppingListDto =
        ShoppingListDto(id = 8, userId = 1, name = request.name)

    override suspend fun getShoppingList(id: Int): ShoppingListDto = ShoppingListDto(id = id, userId = 1, name = "List")

    override suspend fun updateShoppingList(id: Int, request: ShoppingListUpdateDto): ShoppingListDto =
        ShoppingListDto(id = id, userId = 1, name = request.name ?: "List")

    override suspend fun deleteShoppingList(id: Int) = Unit

    override suspend fun importRecurring(id: Int): List<PlannedTodayItemDto> = emptyList()
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
    override fun observeCount(): Flow<Int> = MutableStateFlow(0)

    override suspend fun listAll(): List<PendingMutationEntity> = emptyList()

    override suspend fun enqueue(entity: PendingMutationEntity) = Unit

    override suspend fun delete(id: Long) = Unit

    override suspend fun updateAttempts(id: Long, attempts: Int) = Unit

    override suspend fun markRemoteApplied(id: Long, appliedAtEpochMillis: Long) = Unit
}

private fun recurringItem(id: Int, title: String, plannedFor: String, seriesId: String): PlannedTodayItemDto =
    PlannedTodayItemDto(
        id = id,
        title = title,
        isDone = false,
        plannedFor = plannedFor,
        moduleKey = "recurring_grocery",
        rrule = "FREQ=WEEKLY",
        recurrenceSeriesId = seriesId,
        recurrenceHint = "Weekly",
        linkedSource = "recurring_grocery",
        linkedRef = "7",
        autoAddToListId = 7,
        tags = listOf("pantry")
    )
