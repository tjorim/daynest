package com.daynest.android.feature.templates

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.daynest.android.data.templates.ChoreTemplateDto
import com.daynest.android.data.templates.ChoreTemplateInputDto
import com.daynest.android.data.templates.RoutineTemplateDto
import com.daynest.android.data.templates.RoutineTemplateInputDto
import com.daynest.android.data.templates.TemplatesRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

@HiltViewModel
class TemplatesViewModel
@Inject
constructor(private val repository: TemplatesRepository) : ViewModel() {
    private val _uiState = MutableStateFlow<TemplatesUiState>(TemplatesUiState.Loading)
    val uiState: StateFlow<TemplatesUiState> = _uiState.asStateFlow()

    init {
        load()
    }

    fun onEvent(event: TemplatesUiEvent) {
        when (event) {
            TemplatesUiEvent.RetryClicked -> load()
            is TemplatesUiEvent.TabSelected -> setTab(event.tab)
            TemplatesUiEvent.ShowCreateRoutineForm -> setCreateForm(TemplateCreateForm.Routine)
            TemplatesUiEvent.ShowCreateChoreForm -> setCreateForm(TemplateCreateForm.Chore)
            TemplatesUiEvent.DismissCreateForm -> setCreateForm(null)
            is TemplatesUiEvent.CreateRoutine -> createRoutine(event.input)
            is TemplatesUiEvent.CreateChore -> createChore(event.input)
            is TemplatesUiEvent.UpdateRoutine -> updateRoutine(event.id, event.input)
            is TemplatesUiEvent.UpdateChore -> updateChore(event.id, event.input)
            is TemplatesUiEvent.DeleteRoutine -> deleteRoutine(event.id)
            is TemplatesUiEvent.DeleteChore -> deleteChore(event.id)
        }
    }

    private fun load() {
        viewModelScope.launch {
            _uiState.value = TemplatesUiState.Loading
            val routinesResult = repository.listRoutines()
            val choresResult = repository.listChores()
            if (routinesResult.isSuccess || choresResult.isSuccess) {
                _uiState.value =
                    TemplatesUiState.Content(
                        routines = routinesResult.getOrElse { emptyList() },
                        chores = choresResult.getOrElse { emptyList() },
                        selectedTab =
                        if (routinesResult.isFailure && choresResult.isSuccess) {
                            TemplateTab.Chores
                        } else {
                            TemplateTab.Routines
                        },
                        createForm = null
                    )
            } else {
                _uiState.value = TemplatesUiState.Error
            }
        }
    }

    private fun setTab(tab: TemplateTab) {
        _uiState.update { current ->
            if (current is TemplatesUiState.Content) current.copy(selectedTab = tab) else current
        }
    }

    private fun setCreateForm(form: TemplateCreateForm?) {
        _uiState.update { current ->
            if (current is TemplatesUiState.Content) current.copy(createForm = form) else current
        }
    }

    private fun createRoutine(input: RoutineTemplateInputDto) {
        viewModelScope.launch {
            val result = repository.createRoutine(input)
            result.onSuccess { newRoutine ->
                _uiState.update { current ->
                    if (current is TemplatesUiState.Content) {
                        current.copy(routines = current.routines + newRoutine, createForm = null)
                    } else {
                        current
                    }
                }
            }
        }
    }

    private fun createChore(input: ChoreTemplateInputDto) {
        viewModelScope.launch {
            val result = repository.createChore(input)
            result.onSuccess { newChore ->
                _uiState.update { current ->
                    if (current is TemplatesUiState.Content) {
                        current.copy(chores = current.chores + newChore, createForm = null)
                    } else {
                        current
                    }
                }
            }
        }
    }

    private fun updateRoutine(id: Int, input: RoutineTemplateInputDto) {
        viewModelScope.launch {
            val result = repository.updateRoutine(id, input)
            result
                .onSuccess { updatedRoutine ->
                    _uiState.update { current ->
                        if (current is TemplatesUiState.Content) {
                            current.copy(
                                routines = current.routines.map { if (it.id == id) updatedRoutine else it },
                                operationError = null
                            )
                        } else {
                            current
                        }
                    }
                }.onFailure { error ->
                    Log.e("TemplatesViewModel", "updateRoutine failed", error)
                    _uiState.update { current ->
                        if (current is TemplatesUiState.Content) {
                            current.copy(operationError = error.message ?: "Failed to update routine.")
                        } else {
                            TemplatesUiState.Error
                        }
                    }
                }
        }
    }

    private fun updateChore(id: Int, input: ChoreTemplateInputDto) {
        viewModelScope.launch {
            val result = repository.updateChore(id, input)
            result
                .onSuccess { updatedChore ->
                    _uiState.update { current ->
                        if (current is TemplatesUiState.Content) {
                            current.copy(
                                chores = current.chores.map { if (it.id == id) updatedChore else it },
                                operationError = null
                            )
                        } else {
                            current
                        }
                    }
                }.onFailure { error ->
                    Log.e("TemplatesViewModel", "updateChore failed", error)
                    _uiState.update { current ->
                        if (current is TemplatesUiState.Content) {
                            current.copy(operationError = error.message ?: "Failed to update chore.")
                        } else {
                            TemplatesUiState.Error
                        }
                    }
                }
        }
    }

    private fun deleteRoutine(id: Int) {
        viewModelScope.launch {
            val result = repository.deleteRoutine(id)
            if (result.isSuccess) {
                _uiState.update { current ->
                    if (current is TemplatesUiState.Content) {
                        current.copy(routines = current.routines.filter { it.id != id })
                    } else {
                        current
                    }
                }
            }
        }
    }

    private fun deleteChore(id: Int) {
        viewModelScope.launch {
            val result = repository.deleteChore(id)
            if (result.isSuccess) {
                _uiState.update { current ->
                    if (current is TemplatesUiState.Content) {
                        current.copy(chores = current.chores.filter { it.id != id })
                    } else {
                        current
                    }
                }
            }
        }
    }
}

enum class TemplateTab { Routines, Chores }

enum class TemplateCreateForm { Routine, Chore }

sealed interface TemplatesUiState {
    data object Loading : TemplatesUiState

    data class Content(
        val routines: List<RoutineTemplateDto>,
        val chores: List<ChoreTemplateDto>,
        val selectedTab: TemplateTab,
        val createForm: TemplateCreateForm?,
        val operationError: String? = null
    ) : TemplatesUiState

    data object Error : TemplatesUiState
}

sealed interface TemplatesUiEvent {
    data object RetryClicked : TemplatesUiEvent

    data class TabSelected(val tab: TemplateTab) : TemplatesUiEvent

    data object ShowCreateRoutineForm : TemplatesUiEvent

    data object ShowCreateChoreForm : TemplatesUiEvent

    data object DismissCreateForm : TemplatesUiEvent

    data class CreateRoutine(val input: RoutineTemplateInputDto) : TemplatesUiEvent

    data class CreateChore(val input: ChoreTemplateInputDto) : TemplatesUiEvent

    data class UpdateRoutine(val id: Int, val input: RoutineTemplateInputDto) : TemplatesUiEvent

    data class UpdateChore(val id: Int, val input: ChoreTemplateInputDto) : TemplatesUiEvent

    data class DeleteRoutine(val id: Int) : TemplatesUiEvent

    data class DeleteChore(val id: Int) : TemplatesUiEvent
}
