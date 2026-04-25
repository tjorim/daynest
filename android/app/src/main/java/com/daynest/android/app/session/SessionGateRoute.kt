@file:Suppress("ktlint:standard:function-naming")

package com.daynest.android.app.session

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle

@Composable
fun SessionGateRoute(
    onGoAuth: () -> Unit,
    onGoHome: () -> Unit,
    viewModel: SessionGateViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(uiState) {
        when (uiState) {
            SessionGateUiState.GoAuth -> onGoAuth()
            SessionGateUiState.GoHome -> onGoHome()
            SessionGateUiState.Loading -> Unit
        }
    }

    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center,
    ) {
        if (uiState == SessionGateUiState.Loading) {
            CircularProgressIndicator()
        }
    }
}
