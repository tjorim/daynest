package com.daynest.android.feature.medication

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.daynest.android.data.medication.MedicationHistoryItemDto
import com.daynest.android.data.medication.MedicationPlanDto
import com.daynest.android.data.medication.MedicationPlanInputDto
import com.daynest.android.data.medication.MedicationPlanUpdateDto
import com.daynest.android.data.medication.MedicationRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

@HiltViewModel
class MedicationViewModel
@Inject
constructor(private val repository: MedicationRepository) : ViewModel() {
    private val _uiState = MutableStateFlow<MedicationUiState>(MedicationUiState.Loading)
    val uiState: StateFlow<MedicationUiState> = _uiState.asStateFlow()

    init {
        load()
    }

    fun onEvent(event: MedicationUiEvent) {
        when (event) {
            is MedicationUiEvent.RetryClicked -> load()
            is MedicationUiEvent.CreatePlanClicked -> createPlan(event.input)
            is MedicationUiEvent.UpdatePlanClicked -> updatePlan(event.id, event.input)
            is MedicationUiEvent.DeletePlanClicked -> deletePlan(event.id)
            is MedicationUiEvent.DismissCreateForm -> dismissForm()
            is MedicationUiEvent.ShowCreateForm -> showForm()
        }
    }

    private fun load() {
        viewModelScope.launch {
            _uiState.value = MedicationUiState.Loading
            val plansResult = repository.listPlans()
            val historyResult = repository.getHistory()

            if (plansResult.isSuccess && historyResult.isSuccess) {
                _uiState.value =
                    MedicationUiState.Content(
                        plans = plansResult.getOrElse { emptyList() },
                        history = historyResult.getOrElse { emptyList() },
                        showCreateForm = false
                    )
            } else {
                plansResult.exceptionOrNull()?.let { Log.e("MedicationViewModel", "listPlans failed", it) }
                historyResult.exceptionOrNull()?.let { Log.e("MedicationViewModel", "getHistory failed", it) }
                _uiState.value = MedicationUiState.Error
            }
        }
    }

    private fun showForm() {
        _uiState.update { current ->
            if (current is MedicationUiState.Content) current.copy(showCreateForm = true) else current
        }
    }

    private fun dismissForm() {
        _uiState.update { current ->
            if (current is MedicationUiState.Content) current.copy(showCreateForm = false) else current
        }
    }

    private fun createPlan(input: MedicationPlanInputDto) {
        viewModelScope.launch {
            val result = repository.createPlan(input)
            result.onSuccess { newPlan ->
                _uiState.update { current ->
                    if (current is MedicationUiState.Content) {
                        current.copy(
                            plans = current.plans + newPlan,
                            showCreateForm = false,
                            operationError = null
                        )
                    } else {
                        current
                    }
                }
            }
        }
    }

    private fun updatePlan(id: Int, input: MedicationPlanUpdateDto) {
        viewModelScope.launch {
            val result = repository.updatePlan(id, input)
            result
                .onSuccess { updatedPlan ->
                    _uiState.update { current ->
                        if (current is MedicationUiState.Content) {
                            current.copy(
                                plans = current.plans.map { if (it.id == id) updatedPlan else it },
                                operationError = null
                            )
                        } else {
                            current
                        }
                    }
                }.onFailure { error ->
                    Log.e("MedicationViewModel", "updatePlan failed", error)
                    _uiState.update { current ->
                        if (current is MedicationUiState.Content) {
                            current.copy(operationError = error.message ?: "Failed to update medication plan.")
                        } else {
                            MedicationUiState.Error
                        }
                    }
                }
        }
    }

    private fun deletePlan(id: Int) {
        viewModelScope.launch {
            val result = repository.deletePlan(id)
            if (result.isSuccess) {
                _uiState.update { current ->
                    if (current is MedicationUiState.Content) {
                        current.copy(
                            plans = current.plans.filter { it.id != id },
                            operationError = null
                        )
                    } else {
                        current
                    }
                }
            } else {
                val error = result.exceptionOrNull()
                Log.e("MedicationViewModel", "deletePlan failed", error)
                _uiState.update { current ->
                    if (current is MedicationUiState.Content) {
                        current.copy(operationError = error?.message ?: "Failed to delete medication plan.")
                    } else {
                        MedicationUiState.Error
                    }
                }
            }
        }
    }
}

sealed interface MedicationUiState {
    data object Loading : MedicationUiState

    data class Content(
        val plans: List<MedicationPlanDto>,
        val history: List<MedicationHistoryItemDto>,
        val showCreateForm: Boolean,
        val operationError: String? = null
    ) : MedicationUiState

    data object Error : MedicationUiState
}

sealed interface MedicationUiEvent {
    data object RetryClicked : MedicationUiEvent

    data object ShowCreateForm : MedicationUiEvent

    data object DismissCreateForm : MedicationUiEvent

    data class CreatePlanClicked(val input: MedicationPlanInputDto) : MedicationUiEvent

    data class UpdatePlanClicked(val id: Int, val input: MedicationPlanUpdateDto) : MedicationUiEvent

    data class DeletePlanClicked(val id: Int) : MedicationUiEvent
}
