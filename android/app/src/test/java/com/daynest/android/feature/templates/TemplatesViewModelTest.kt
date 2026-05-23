package com.daynest.android.feature.templates

import com.daynest.android.data.templates.ChoreTemplateDto
import com.daynest.android.data.templates.ChoreTemplateInputDto
import com.daynest.android.data.templates.RoutineTemplateDto
import com.daynest.android.data.templates.RoutineTemplateInputDto
import com.daynest.android.data.templates.TemplatesApi
import com.daynest.android.data.templates.TemplatesRepository
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
class TemplatesViewModelTest {
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
    fun `state loads templates into content`() =
        runTest {
            val viewModel =
                TemplatesViewModel(
                    repository = TemplatesRepository(FakeTemplatesApi()),
                )

            advanceUntilIdle()

            val state = viewModel.uiState.value
            assertTrue(state is TemplatesUiState.Content)
            state as TemplatesUiState.Content
            assertEquals(1, state.routines.size)
            assertEquals(1, state.chores.size)
            assertEquals(TemplateTab.Routines, state.selectedTab)
        }

    @Test
    fun `delete routine event removes routine from state`() =
        runTest {
            val viewModel =
                TemplatesViewModel(
                    repository = TemplatesRepository(FakeTemplatesApi()),
                )

            advanceUntilIdle()
            viewModel.onEvent(TemplatesUiEvent.DeleteRoutine(1))
            advanceUntilIdle()

            val state = viewModel.uiState.value as TemplatesUiState.Content
            assertTrue(state.routines.isEmpty())
        }
}

private class FakeTemplatesApi : TemplatesApi {
    private val routines =
        mutableListOf(
            RoutineTemplateDto(
                id = 1,
                name = "Daily walk",
                description = "Neighborhood loop",
                startDate = "2026-01-01",
                everyNDays = 1,
                dueTime = "08:00:00",
                isActive = true,
                createdAt = "2026-01-01T00:00:00Z",
            ),
        )
    private val chores =
        mutableListOf(
            ChoreTemplateDto(
                id = 2,
                name = "Laundry",
                description = "Whites",
                startDate = "2026-01-01",
                everyNDays = 7,
                isActive = true,
                createdAt = "2026-01-01T00:00:00Z",
            ),
        )

    override suspend fun listRoutines(): List<RoutineTemplateDto> = routines.toList()

    override suspend fun createRoutine(request: RoutineTemplateInputDto): RoutineTemplateDto {
        val routine =
            RoutineTemplateDto(
                id = (routines.maxOfOrNull { it.id } ?: 0) + 1,
                name = request.name,
                description = request.description,
                startDate = request.startDate,
                everyNDays = request.everyNDays,
                dueTime = request.dueTime,
                isActive = request.isActive,
                createdAt = "2026-01-01T00:00:00Z",
            )
        routines += routine
        return routine
    }

    override suspend fun updateRoutine(
        id: Int,
        request: RoutineTemplateInputDto,
    ): RoutineTemplateDto {
        val index = routines.indexOfFirst { it.id == id }
        check(index >= 0) { "Unknown routine id: $id" }
        val updated =
            routines[index].copy(
                name = request.name,
                description = request.description,
                startDate = request.startDate,
                everyNDays = request.everyNDays,
                dueTime = request.dueTime,
                isActive = request.isActive,
            )
        routines[index] = updated
        return updated
    }

    override suspend fun deleteRoutine(id: Int) {
        routines.removeAll { it.id == id }
    }

    override suspend fun listChores(): List<ChoreTemplateDto> = chores.toList()

    override suspend fun createChore(request: ChoreTemplateInputDto): ChoreTemplateDto {
        val chore =
            ChoreTemplateDto(
                id = (chores.maxOfOrNull { it.id } ?: 0) + 1,
                name = request.name,
                description = request.description,
                startDate = request.startDate,
                everyNDays = request.everyNDays,
                isActive = request.isActive,
                createdAt = "2026-01-01T00:00:00Z",
            )
        chores += chore
        return chore
    }

    override suspend fun updateChore(
        id: Int,
        request: ChoreTemplateInputDto,
    ): ChoreTemplateDto {
        val index = chores.indexOfFirst { it.id == id }
        check(index >= 0) { "Unknown chore id: $id" }
        val updated =
            chores[index].copy(
                name = request.name,
                description = request.description,
                startDate = request.startDate,
                everyNDays = request.everyNDays,
                isActive = request.isActive,
            )
        chores[index] = updated
        return updated
    }

    override suspend fun deleteChore(id: Int) {
        chores.removeAll { it.id == id }
    }
}
