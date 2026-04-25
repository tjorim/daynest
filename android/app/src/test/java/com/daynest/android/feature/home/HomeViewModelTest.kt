package com.daynest.android.feature.home

import org.junit.Assert.assertEquals
import org.junit.Test

class HomeViewModelTest {
    @Test
    fun `state starts with expected copy`() {
        val viewModel = HomeViewModel()

        val state = viewModel.state.value

        assertEquals("Welcome to Daynest", state.greeting)
        assertEquals("Native Android foundation is ready.", state.subtitle)
        assertEquals("Plan today", state.primaryActionLabel)
    }
}
