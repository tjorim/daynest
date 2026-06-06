package com.daynest.android.feature.shopping

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
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
        private val shoppingListRepository: ShoppingListRepository,
        private val plannedItemRepository: PlannedItemRepository,
    ) : ViewModel() {
        private val _uiState = MutableStateFlow(ShoppingUiState())
        val uiState: StateFlow<ShoppingUiState> = _uiState.asStateFlow()

        private val _effects = MutableSharedFlow<String>()
        val effects: SharedFlow<String> = _effects.asSharedFlow()

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
            viewModelScope.launch {
                _uiState.update { it.copy(selectedListId = id, isLoadingItems = true, error = null) }
                val listResult = shoppingListRepository.getShoppingList(id)
                val itemResult = plannedItemRepository.listPlannedItems(null, null)
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
            _uiState.update { it.copy(selectedListId = null, selectedList = null, items = emptyList(), isLoadingItems = false) }
        }

        fun createList(
            name: String,
            store: String?,
            notes: String?,
        ) {
            if (name.isBlank()) return
            viewModelScope.launch {
                shoppingListRepository
                    .createShoppingList(ShoppingListCreateDto(name = name.trim(), store = store.blankToNull(), notes = notes.blankToNull()))
                    .onSuccess {
                        _effects.emit("Shopping list added")
                        refreshLists()
                    }.onFailure { _effects.emit(it.message ?: "Unable to add shopping list") }
            }
        }

        fun archiveList(list: ShoppingListDto) {
            viewModelScope.launch {
                shoppingListRepository
                    .updateShoppingList(list.id, ShoppingListUpdateDto(status = ShoppingListStatus.ARCHIVED))
                    .onSuccess { refreshLists() }
                    .onFailure { _effects.emit(it.message ?: "Unable to archive shopping list") }
            }
        }

        fun deleteList(id: Int) {
            viewModelScope.launch {
                shoppingListRepository
                    .deleteShoppingList(id)
                    .onSuccess { refreshLists() }
                    .onFailure { _effects.emit(it.message ?: "Unable to delete shopping list") }
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
                        _effects.emit("Shopping item added")
                        selectList(listId)
                    }.onFailure { _effects.emit(it.message ?: "Unable to add shopping item") }
            }
        }

        fun checkOffItem(item: PlannedTodayItemDto) {
            val listId = _uiState.value.selectedListId ?: return
            viewModelScope.launch {
                plannedItemRepository
                    .updatePlannedItem(
                        item.id,
                        PlannedItemUpdateDto(
                            title = item.title,
                            plannedFor = item.plannedFor,
                            timeOfDay = item.timeOfDay,
                            durationMinutes = item.durationMinutes,
                            isDone = true,
                            notes = item.notes,
                            moduleKey = item.moduleKey,
                            rrule = item.rrule,
                            recurrenceHint = item.recurrenceHint,
                            linkedSource = item.linkedSource ?: SHOPPING_LIST_MODULE,
                            linkedRef = item.linkedRef,
                            priority = item.priority,
                            tags = item.tags,
                        ),
                    ).onSuccess { selectList(listId) }
                    .onFailure { _effects.emit(it.message ?: "Unable to check off shopping item") }
            }
        }
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

private fun List<PlannedTodayItemDto>.shoppingItemsFor(listId: Int): List<PlannedTodayItemDto> =
    filter { it.moduleKey == SHOPPING_LIST_MODULE && it.linkedRef == listId.toString() }
        .sortedWith(compareBy<PlannedTodayItemDto> { it.isDone }.thenBy { it.title.lowercase() })

private fun String?.blankToNull(): String? = this?.trim()?.takeIf { it.isNotBlank() }

private const val SHOPPING_LIST_MODULE = "shopping_list"
