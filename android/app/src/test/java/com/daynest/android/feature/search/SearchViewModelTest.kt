package com.daynest.android.feature.search

import com.daynest.android.data.search.SearchApi
import com.daynest.android.data.search.SearchRepository
import com.daynest.android.data.search.SearchResponseDto
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceTimeBy
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
class SearchViewModelTest {
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
    fun `short query clears results without searching`() = runTest {
        val api = FakeSearchApi()
        val viewModel = SearchViewModel(SearchRepository(api))

        viewModel.onQueryChanged("m")
        advanceUntilIdle()

        assertEquals("m", viewModel.uiState.value.query)
        assertNull(viewModel.uiState.value.results)
        assertFalse(viewModel.uiState.value.isSearching)
        assertEquals(0, api.queries.size)
    }

    @Test
    fun `debounced query publishes results`() = runTest {
        val api = FakeSearchApi(response = SearchResponseDto(query = "milk"))
        val viewModel = SearchViewModel(SearchRepository(api))

        viewModel.onQueryChanged(" milk ")
        advanceTimeBy(300)
        advanceUntilIdle()

        assertEquals(listOf("milk" to 20), api.queries)
        assertEquals("milk", viewModel.uiState.value.results?.query)
        assertFalse(viewModel.uiState.value.isSearching)
    }

    @Test
    fun `repository failure surfaces message`() = runTest {
        val viewModel = SearchViewModel(SearchRepository(FakeSearchApi(error = IllegalStateException("search failed"))))

        viewModel.onQueryChanged("milk")
        advanceTimeBy(300)
        advanceUntilIdle()

        assertNull(viewModel.uiState.value.results)
        assertEquals("search failed", viewModel.uiState.value.error)
        assertFalse(viewModel.uiState.value.isSearching)
    }

    @Test
    fun `new query cancels previous pending search`() = runTest {
        val api = FakeSearchApi()
        val viewModel = SearchViewModel(SearchRepository(api))

        viewModel.onQueryChanged("mi")
        advanceTimeBy(100)
        viewModel.onQueryChanged("milk")
        advanceTimeBy(300)
        advanceUntilIdle()

        assertEquals(listOf("milk" to 20), api.queries)
        assertTrue(viewModel.uiState.value.error == null)
    }
}

private class FakeSearchApi(
    private val response: SearchResponseDto = SearchResponseDto(query = ""),
    private val error: Throwable? = null
) : SearchApi {
    val queries = mutableListOf<Pair<String, Int>>()

    override suspend fun search(query: String, limit: Int): SearchResponseDto {
        queries += query to limit
        error?.let { throw it }
        return response.copy(query = query)
    }
}
