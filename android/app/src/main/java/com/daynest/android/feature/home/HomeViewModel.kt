package com.daynest.android.feature.home

import androidx.lifecycle.ViewModel
import com.daynest.android.core.model.TodoSummaryUiModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

class HomeViewModel : ViewModel() {
    private val _state = MutableStateFlow(
        TodoSummaryUiModel(
            greeting = "Welcome to Daynest",
            subtitle = "Native Android foundation is ready.",
            primaryActionLabel = "Plan today",
        ),
    )

    val state = _state.asStateFlow()
}
