package com.daynest.android.feature.mealplan

import android.app.Application
import androidx.annotation.StringRes
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.daynest.android.R
import com.daynest.android.data.mealplan.MealPlanCreateDto
import com.daynest.android.data.mealplan.MealPlanDto
import com.daynest.android.data.mealplan.MealPlanRepository
import com.daynest.android.data.mealplan.MealSlotDto
import com.daynest.android.data.mealplan.MealSlotUpdateDto
import com.daynest.android.data.mealplan.WeekGridDto
import dagger.hilt.android.lifecycle.HiltViewModel
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.temporal.TemporalAdjusters
import javax.inject.Inject
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

@HiltViewModel
class MealPlannerViewModel
@Inject
constructor(
    application: Application,
    private val mealPlanRepository: MealPlanRepository
) : AndroidViewModel(application) {
    private val _uiState = MutableStateFlow(MealPlannerUiState(weekStart = currentWeekStart()))
    val uiState: StateFlow<MealPlannerUiState> = _uiState.asStateFlow()

    private val _effects = MutableSharedFlow<String>()
    val effects: SharedFlow<String> = _effects.asSharedFlow()

    private var loadJob: Job? = null

    init {
        loadWeek()
    }

    fun loadWeek() {
        val weekStart = _uiState.value.weekStart
        loadJob?.cancel()
        loadJob =
            viewModelScope.launch {
                _uiState.update { it.copy(isLoading = true, error = null) }
                mealPlanRepository
                    .listMealPlans()
                    .fold(
                        onSuccess = { plans ->
                            val plan = plans.firstOrNull { it.weekStart == weekStart.toString() }
                            if (plan == null) {
                                createWeekPlan(weekStart)
                            } else {
                                loadGrid(plan)
                            }
                        },
                        onFailure = { failure ->
                            _uiState.update { it.copy(isLoading = false, error = failure.message) }
                        }
                    )
            }
    }

    fun previousWeek() {
        _uiState.update { it.copy(weekStart = it.weekStart.minusWeeks(1), weekGrid = null) }
        loadWeek()
    }

    fun nextWeek() {
        _uiState.update { it.copy(weekStart = it.weekStart.plusWeeks(1), weekGrid = null) }
        loadWeek()
    }

    fun editSlot(slot: MealSlotDto) {
        _uiState.update { it.copy(editingSlot = slot, draft = MealSlotDraft.from(slot)) }
    }

    fun dismissEditor() {
        _uiState.update { it.copy(editingSlot = null, draft = MealSlotDraft()) }
    }

    fun updateDraft(draft: MealSlotDraft) {
        _uiState.update { it.copy(draft = draft) }
    }

    fun saveSlot() {
        val state = _uiState.value
        val planId = state.weekGrid?.mealPlan?.id ?: return
        val slot = state.editingSlot ?: return
        val draft = state.draft
        viewModelScope.launch {
            mealPlanRepository
                .updateSlot(
                    mealPlanId = planId,
                    slotId = slot.id,
                    request =
                    MealSlotUpdateDto(
                        title = draft.title.trim().ifBlank { null },
                        recipeUrl = draft.recipeUrl.trim().ifBlank { null },
                        ingredients =
                        draft.ingredients
                            .lines()
                            .map { it.trim() }
                            .filter { it.isNotBlank() },
                        plannedItemId = slot.plannedItemId
                    )
                ).onSuccess { updatedSlot ->
                    _uiState.update { current ->
                        current.copy(
                            editingSlot = null,
                            draft = MealSlotDraft(),
                            weekGrid = current.weekGrid?.replaceSlot(updatedSlot)
                        )
                    }
                    _effects.emit(getString(R.string.meal_plan_slot_saved))
                }.onFailure { _effects.emit(it.message ?: getString(R.string.meal_plan_error_save_slot)) }
        }
    }

    fun generateShoppingList() {
        val planId =
            _uiState.value.weekGrid
                ?.mealPlan
                ?.id ?: return
        viewModelScope.launch {
            mealPlanRepository
                .generateShoppingList(planId)
                .onSuccess { response ->
                    _effects.emit(
                        getApplication<Application>()
                            .resources
                            .getQuantityString(
                                R.plurals.meal_plan_shopping_list_generated,
                                response.items.size,
                                response.items.size
                            )
                    )
                }.onFailure { error ->
                    _effects.emit(error.message ?: getString(R.string.meal_plan_error_generate_shopping_list))
                }
        }
    }

    private suspend fun createWeekPlan(weekStart: LocalDate) {
        mealPlanRepository
            .createMealPlan(
                MealPlanCreateDto(
                    name =
                    getApplication<Application>().getString(
                        R.string.meal_plan_default_name,
                        weekStart.format(DateTimeFormatter.ISO_DATE)
                    ),
                    weekStart = weekStart.toString()
                )
            ).fold(
                onSuccess = { loadGrid(it) },
                onFailure = { failure -> _uiState.update { it.copy(isLoading = false, error = failure.message) } }
            )
    }

    private suspend fun loadGrid(plan: MealPlanDto) {
        mealPlanRepository
            .getWeekPlan(plan.id)
            .fold(
                onSuccess = { week ->
                    _uiState.update { it.copy(weekGrid = week, isLoading = false, error = null) }
                },
                onFailure = { failure -> _uiState.update { it.copy(isLoading = false, error = failure.message) } }
            )
    }

    private fun getString(@StringRes resId: Int): String = getApplication<Application>().getString(resId)
}

data class MealPlannerUiState(
    val weekStart: LocalDate,
    val weekGrid: WeekGridDto? = null,
    val isLoading: Boolean = false,
    val error: String? = null,
    val editingSlot: MealSlotDto? = null,
    val draft: MealSlotDraft = MealSlotDraft()
)

data class MealSlotDraft(val title: String = "", val recipeUrl: String = "", val ingredients: String = "") {
    companion object {
        fun from(slot: MealSlotDto): MealSlotDraft = MealSlotDraft(
            title = slot.title,
            recipeUrl = slot.recipeUrl.orEmpty(),
            ingredients = slot.ingredients.joinToString("\n")
        )
    }
}

private fun currentWeekStart(): LocalDate = LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))

private fun WeekGridDto.replaceSlot(slot: MealSlotDto): WeekGridDto = copy(
    days =
    days.map { day ->
        if (day.date == slot.slotDate) {
            day.copy(slots = day.slots + (slot.slotType to slot))
        } else {
            day
        }
    }
)
