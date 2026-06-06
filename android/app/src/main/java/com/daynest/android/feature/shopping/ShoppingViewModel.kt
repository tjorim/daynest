package com.daynest.android.feature.shopping

import android.app.Application
import androidx.annotation.StringRes
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.daynest.android.R
import com.daynest.android.data.shopping.ShoppingListCreateDto
import com.daynest.android.data.shopping.ShoppingListDto
import com.daynest.android.data.shopping.ShoppingListRepository
import com.daynest.android.data.shopping.ShoppingListStatus
import com.daynest.android.data.shopping.ShoppingListUpdateDto
import com.daynest.android.data.today.PlannedItemCreateDto
import com.daynest.android.data.today.PlannedItemRepository
import com.daynest.android.data.today.PlannedItemUpdateDto
import com.daynest.android.data.today.PlannedTodayItemDto
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.LocalDate
import javax.inject.Inject

@HiltViewModel
class ShoppingViewModel
    @Inject
    constructor(
        application: Application,
        private val shoppingListRepository: ShoppingListRepository,
        private val plannedItemRepository: PlannedItemRepository,
    ) : AndroidViewModel(application) {
        private val _uiState = MutableStateFlow(ShoppingUiState())
        val uiState: StateFlow<ShoppingUiState> = _uiState.asStateFlow()

        private val _effects = MutableSharedFlow<String>()
        val effects: SharedFlow<String> = _effects.asSharedFlow()

        private var selectListJob: Job? = null

        init {
            refreshLists()
        }

        fun refreshLists() {
            viewModelScope.launch {
                _uiState.update { it.copy(isLoadingLists = true, error = null) }
                shoppingListRepository
                    .listShoppingLists(ShoppingListStatus.ALL)
                    .fold(
                        onSuccess = { lists -> _uiState.update { it.copy(lists = lists, isLoadingLists = false) } },
                        onFailure = { failure ->
                            _uiState.update { it.copy(isLoadingLists = false, error = failure.message) }
                        },
                    )
            }
        }

        fun selectList(id: Int) {
            selectListJob?.cancel()
            selectListJob =
                viewModelScope.launch {
                    _uiState.update { it.copy(selectedListId = id, isLoadingItems = true, error = null) }
                    val listDeferred = async { shoppingListRepository.getShoppingList(id) }
                    val itemDeferred = async { plannedItemRepository.listPlannedItems(null, null) }
                    val listResult = listDeferred.await()
                    val itemResult = itemDeferred.await()
                    val list = listResult.getOrNull()
                    val items = itemResult.getOrNull()?.shoppingItemsFor(id).orEmpty()
                    _uiState.update { state ->
                        state.copy(
                            selectedListId = id,
                            selectedList = list ?: state.lists.firstOrNull { it.id == id },
                            items = items,
                            isLoadingItems = false,
                            error = listResult.exceptionOrNull()?.message ?: itemResult.exceptionOrNull()?.message,
                        )
                    }
                }
        }

        fun clearSelection() {
            _uiState.update {
                it.copy(
                    selectedListId = null,
                    selectedList = null,
                    items = emptyList(),
                    isLoadingItems = false,
                )
            }
        }

        fun createList(
            name: String,
            store: String?,
            notes: String?,
        ) {
            if (name.isBlank()) return
            viewModelScope.launch {
                shoppingListRepository
                    .createShoppingList(
                        ShoppingListCreateDto(
                            name = name.trim(),
                            store = store.blankToNull(),
                            notes = notes.blankToNull(),
                        ),
                    ).onSuccess {
                        _effects.emit(getString(R.string.shopping_list_added))
                        refreshLists()
                    }.onFailure { _effects.emit(it.message ?: getString(R.string.shopping_error_add_list)) }
            }
        }

        fun archiveList(list: ShoppingListDto) {
            viewModelScope.launch {
                shoppingListRepository
                    .updateShoppingList(list.id, ShoppingListUpdateDto(status = ShoppingListStatus.ARCHIVED))
                    .onSuccess { refreshLists() }
                    .onFailure { _effects.emit(it.message ?: getString(R.string.shopping_error_archive_list)) }
            }
        }

        fun deleteList(id: Int) {
            viewModelScope.launch {
                shoppingListRepository
                    .deleteShoppingList(id)
                    .onSuccess { refreshLists() }
                    .onFailure { _effects.emit(it.message ?: getString(R.string.shopping_error_delete_list)) }
            }
        }

        fun addItem(
            title: String,
            tag: String?,
            notes: String?,
        ) {
            val listId = _uiState.value.selectedListId ?: return
            if (title.isBlank()) return
            viewModelScope.launch {
                plannedItemRepository
                    .createPlannedItem(
                        PlannedItemCreateDto(
                            title = title.trim(),
                            plannedFor = LocalDate.now().toString(),
                            notes = notes.blankToNull(),
                            moduleKey = SHOPPING_LIST_MODULE,
                            linkedSource = SHOPPING_LIST_MODULE,
                            linkedRef = listId.toString(),
                            tags = tag.blankToNull()?.let(::listOf).orEmpty(),
                        ),
                    ).onSuccess {
                        _effects.emit(getString(R.string.shopping_item_added))
                        selectList(listId)
                    }.onFailure { _effects.emit(it.message ?: getString(R.string.shopping_error_add_item)) }
            }
        }

        fun addRecurringItem(
            title: String,
            plannedFor: String,
            tag: String?,
            notes: String?,
            rrule: String?,
            recurrenceHint: String?,
        ) {
            val listId = _uiState.value.selectedListId ?: return
            if (title.isBlank() || plannedFor.isBlank()) return
            viewModelScope.launch {
                plannedItemRepository
                    .createPlannedItem(
                        PlannedItemCreateDto(
                            title = title.trim(),
                            plannedFor = plannedFor.trim(),
                            notes = notes.blankToNull(),
                            moduleKey = RECURRING_GROCERY_MODULE,
                            rrule = rrule.blankToNull(),
                            recurrenceHint = recurrenceHint.blankToNull() ?: DEFAULT_RECURRING_GROCERY_HINT,
                            linkedSource = SHOPPING_LIST_MODULE,
                            linkedRef = listId.toString(),
                            autoAddToListId = listId,
                            tags = tag.blankToNull()?.split(",")?.map { it.trim() }?.filter { it.isNotBlank() }.orEmpty(),
                        ),
                    ).onSuccess {
                        _effects.emit(getString(R.string.shopping_recurring_item_added))
                        selectList(listId)
                    }.onFailure { _effects.emit(it.message ?: getString(R.string.shopping_error_add_recurring_item)) }
            }
        }

        fun importRecurringItems() {
            val listId = _uiState.value.selectedListId ?: return
            viewModelScope.launch {
                shoppingListRepository
                    .importRecurring(listId)
                    .onSuccess { imported ->
                        _effects.emit(
                            getApplication<Application>()
                                .resources
                                .getQuantityString(
                                    R.plurals.shopping_recurring_imported,
                                    imported.size,
                                    imported.size,
                                ),
                        )
                        selectList(listId)
                    }.onFailure { _effects.emit(it.message ?: getString(R.string.shopping_error_import_recurring)) }
            }
        }

        fun checkOffItem(item: PlannedTodayItemDto) {
            val listId = _uiState.value.selectedListId ?: return
            viewModelScope.launch {
                plannedItemRepository
                    .updatePlannedItem(item.id, item.toUpdateDto(isDone = true))
                    .onSuccess { selectList(listId) }
                    .onFailure { _effects.emit(it.message ?: getString(R.string.shopping_error_check_off_item)) }
            }
        }

        private fun getString(
            @StringRes resId: Int,
        ): String = getApplication<Application>().getString(resId)
    }

data class ShoppingUiState(
    val lists: List<ShoppingListDto> = emptyList(),
    val selectedListId: Int? = null,
    val selectedList: ShoppingListDto? = null,
    val items: List<PlannedTodayItemDto> = emptyList(),
    val isLoadingLists: Boolean = false,
    val isLoadingItems: Boolean = false,
    val error: String? = null,
)

private fun PlannedTodayItemDto.toUpdateDto(isDone: Boolean = this.isDone): PlannedItemUpdateDto =
    PlannedItemUpdateDto(
        title = title,
        plannedFor = plannedFor,
        timeOfDay = timeOfDay,
        durationMinutes = durationMinutes,
        isDone = isDone,
        notes = notes,
        moduleKey = moduleKey,
        rrule = rrule,
        recurrenceHint = recurrenceHint,
        linkedSource = linkedSource,
        linkedRef = linkedRef,
        priority = priority,
        tags = tags,
    )

private fun List<PlannedTodayItemDto>.shoppingItemsFor(listId: Int): List<PlannedTodayItemDto> =
    filter { it.moduleKey == SHOPPING_LIST_MODULE && it.linkedRef == listId.toString() }
        .sortedWith(compareBy<PlannedTodayItemDto> { it.isDone }.thenBy { it.title.lowercase() })

private fun String?.blankToNull(): String? = this?.trim()?.takeIf { it.isNotBlank() }

private const val SHOPPING_LIST_MODULE = "shopping_list"
private const val RECURRING_GROCERY_MODULE = "recurring_grocery"
private const val DEFAULT_RECURRING_GROCERY_HINT = "weekly"
