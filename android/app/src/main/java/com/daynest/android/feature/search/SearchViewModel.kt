package com.daynest.android.feature.search

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.daynest.android.data.search.SearchRepository
import com.daynest.android.data.search.SearchResponseDto
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

private const val MIN_QUERY_LENGTH = 2
private const val DEBOUNCE_MS = 300L

@HiltViewModel
class SearchViewModel
@Inject
constructor(private val searchRepository: SearchRepository) : ViewModel() {
    private val _uiState = MutableStateFlow(SearchUiState())
    val uiState: StateFlow<SearchUiState> = _uiState.asStateFlow()

    private var searchJob: Job? = null

    fun onQueryChanged(query: String) {
        _uiState.update { it.copy(query = query) }
        searchJob?.cancel()

        val trimmed = query.trim()
        if (trimmed.length < MIN_QUERY_LENGTH) {
            _uiState.update { it.copy(results = null, isSearching = false, error = null) }
            return
        }

        searchJob =
            viewModelScope.launch {
                _uiState.update { it.copy(isSearching = true, error = null) }
                delay(DEBOUNCE_MS)
                searchRepository.search(trimmed).fold(
                    onSuccess = { response -> _uiState.update { it.copy(results = response, isSearching = false) } },
                    onFailure = { error ->
                        _uiState.update { it.copy(isSearching = false, error = error.message) }
                    }
                )
            }
    }
}

data class SearchUiState(
    val query: String = "",
    val results: SearchResponseDto? = null,
    val isSearching: Boolean = false,
    val error: String? = null
)
