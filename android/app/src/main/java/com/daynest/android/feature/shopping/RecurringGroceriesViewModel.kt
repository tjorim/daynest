package com.daynest.android.feature.shopping

import android.app.Application
import androidx.annotation.StringRes
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.daynest.android.R
import com.daynest.android.data.shopping.ShoppingListDto
import com.daynest.android.data.shopping.ShoppingListRepository
import com.daynest.android.data.shopping.ShoppingListStatus
import com.daynest.android.data.today.DeleteScope
import com.daynest.android.data.today.EditScope
import com.daynest.android.data.today.PlannedItemCreateDto
import com.daynest.android.data.today.PlannedItemRepository
import com.daynest.android.data.today.PlannedItemUpdateDto
import com.daynest.android.data.today.PlannedTodayItemDto
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

@HiltViewModel
class RecurringGroceriesViewModel
@Inject
constructor(
    application: Application,
    private val plannedItemRepository: PlannedItemRepository,
    private val shoppingListRepository: ShoppingListRepository
) : AndroidViewModel(application) {
    private val _uiState = MutableStateFlow(RecurringGroceriesUiState())
    val uiState: StateFlow<RecurringGroceriesUiState> = _uiState.asStateFlow()

    private val _effects = MutableSharedFlow<String>()
    val effects: SharedFlow<String> = _effects.asSharedFlow()

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            val itemsDeferred = async { plannedItemRepository.listPlannedItems(null, null) }
            val listsDeferred = async { shoppingListRepository.listShoppingLists(ShoppingListStatus.ACTIVE) }
            val itemsResult = itemsDeferred.await()
            val listsResult = listsDeferred.await()
            _uiState.update { state ->
                state.copy(
                    series = itemsResult.getOrNull()?.toRecurringGrocerySeries().orEmpty(),
                    shoppingLists = listsResult.getOrElse { state.shoppingLists },
                    isLoading = false,
                    error = itemsResult.exceptionOrNull()?.message ?: listsResult.exceptionOrNull()?.message
                )
            }
        }
    }

    fun save(input: RecurringGroceryInput, editing: RecurringGrocerySeries?) {
        if (input.title.isBlank() || input.startDate.isBlank() || input.rrule.isBlank()) return
        viewModelScope.launch {
            val result =
                if (editing != null) {
                    plannedItemRepository.updatePlannedItem(
                        editing.representativeId,
                        PlannedItemUpdateDto(
                            title = input.title.trim(),
                            plannedFor = input.startDate.trim(),
                            isDone = false,
                            notes = input.notes,
                            moduleKey = RECURRING_GROCERY_MODULE,
                            rrule = input.rrule.trim(),
                            recurrenceHint = input.recurrenceHint,
                            linkedSource = RECURRING_GROCERY_MODULE,
                            linkedRef = input.autoAddToListId?.toString(),
                            autoAddToListId = input.autoAddToListId,
                            tags = input.tags
                        ),
                        EditScope.ALL
                    )
                } else {
                    plannedItemRepository.createPlannedItem(
                        PlannedItemCreateDto(
                            title = input.title.trim(),
                            plannedFor = input.startDate.trim(),
                            notes = input.notes,
                            moduleKey = RECURRING_GROCERY_MODULE,
                            rrule = input.rrule.trim(),
                            recurrenceHint = input.recurrenceHint,
                            linkedSource = RECURRING_GROCERY_MODULE,
                            linkedRef = input.autoAddToListId?.toString(),
                            autoAddToListId = input.autoAddToListId,
                            tags = input.tags
                        )
                    )
                }
            result
                .onSuccess { savedItem ->
                    _effects.emit(getString(R.string.shopping_recurring_saved))
                    updateSavedSeries(savedItem, editing)
                }.onFailure { _effects.emit(it.message ?: getString(R.string.shopping_error_add_recurring_item)) }
        }
    }

    fun delete(series: RecurringGrocerySeries) {
        viewModelScope.launch {
            plannedItemRepository
                .deletePlannedItem(series.representativeId, DeleteScope.FUTURE)
                .onSuccess { removeSeries(series) }
                .onFailure { _effects.emit(it.message ?: getString(R.string.shopping_error_delete_recurring_item)) }
        }
    }

    private fun updateSavedSeries(savedItem: PlannedTodayItemDto, editing: RecurringGrocerySeries?) {
        val savedSeries = savedItem.toRecurringGrocerySeries()
        _uiState.update { state ->
            val series =
                state.series
                    .filterNot { it.key == editing?.key || it.key == savedSeries.key }
                    .plus(savedSeries)
                    .sortedWith(compareBy({ it.title.lowercase() }, { it.startDate }))
            state.copy(series = series)
        }
    }

    private fun removeSeries(series: RecurringGrocerySeries) {
        _uiState.update { state ->
            state.copy(series = state.series.filterNot { it.key == series.key })
        }
    }

    private fun getString(@StringRes resId: Int): String = getApplication<Application>().getString(resId)
}

data class RecurringGroceriesUiState(
    val series: List<RecurringGrocerySeries> = emptyList(),
    val shoppingLists: List<ShoppingListDto> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null
)

data class RecurringGrocerySeries(
    val key: String,
    val representativeId: Int,
    val title: String,
    val startDate: String,
    val notes: String?,
    val rrule: String,
    val recurrenceHint: String?,
    val autoAddToListId: Int?,
    val tags: List<String>
)

data class RecurringGroceryInput(
    val title: String,
    val startDate: String,
    val notes: String?,
    val rrule: String,
    val recurrenceHint: String?,
    val autoAddToListId: Int?,
    val tags: List<String> = emptyList()
)

private fun List<PlannedTodayItemDto>.toRecurringGrocerySeries(): List<RecurringGrocerySeries> {
    val grouped = LinkedHashMap<String, PlannedTodayItemDto>()
    for (item in this) {
        if (item.moduleKey != RECURRING_GROCERY_MODULE || item.rrule.isNullOrBlank()) continue
        val key = item.recurrenceSeriesId ?: "item-${item.id}"
        val existing = grouped[key]
        if (existing == null || item.plannedFor < existing.plannedFor) {
            grouped[key] = item
        }
    }
    return grouped.values
        .sortedWith(compareBy({ it.title.lowercase() }, { it.plannedFor }))
        .map { item ->
            item.toRecurringGrocerySeries()
        }
}

private fun PlannedTodayItemDto.toRecurringGrocerySeries(): RecurringGrocerySeries = RecurringGrocerySeries(
    key = recurrenceSeriesId ?: "item-$id",
    representativeId = id,
    title = title,
    startDate = plannedFor,
    notes = notes,
    rrule = rrule.orEmpty(),
    recurrenceHint = recurrenceHint,
    autoAddToListId = autoAddToListId,
    tags = tags
)

private const val RECURRING_GROCERY_MODULE = "recurring_grocery"
