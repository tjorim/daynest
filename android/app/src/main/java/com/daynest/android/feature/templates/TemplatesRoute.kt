@file:Suppress("ktlint:standard:function-naming", "FunctionNaming")

package com.daynest.android.feature.templates

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.daynest.android.R
import com.daynest.android.app.navigation.DaynestDestination
import com.daynest.android.app.navigation.DaynestNavigationScaffold
import com.daynest.android.data.templates.ChoreTemplateDto
import com.daynest.android.data.templates.RoutineTemplateDto

@Composable
fun TemplatesRoute(onNavigate: (String) -> Unit = {}, viewModel: TemplatesViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    TemplatesScreen(uiState = uiState, onEvent = viewModel::onEvent, onNavigate = onNavigate)
}

@Composable
private fun TemplatesScreen(
    uiState: TemplatesUiState,
    onEvent: (TemplatesUiEvent) -> Unit,
    onNavigate: (String) -> Unit
) {
    val selectedTab =
        (uiState as? TemplatesUiState.Content)?.selectedTab ?: TemplateTab.Routines
    DaynestNavigationScaffold(
        currentRoute = DaynestDestination.TEMPLATES,
        onNavigate = onNavigate,
        floatingActionButton = {
            TemplatesFloatingActionButton(
                isVisible = uiState is TemplatesUiState.Content,
                selectedTab = selectedTab,
                onEvent = onEvent
            )
        }
    ) { innerPadding ->
        TemplatesScreenContent(
            uiState = uiState,
            onEvent = onEvent,
            innerPadding = innerPadding
        )
    }
}

@Composable
private fun TemplatesFloatingActionButton(
    isVisible: Boolean,
    selectedTab: TemplateTab,
    onEvent: (TemplatesUiEvent) -> Unit
) {
    if (!isVisible) return

    FloatingActionButton(
        onClick = {
            onEvent(
                if (selectedTab == TemplateTab.Routines) {
                    TemplatesUiEvent.ShowCreateRoutineForm
                } else {
                    TemplatesUiEvent.ShowCreateChoreForm
                }
            )
        }
    ) {
        Text(text = stringResource(id = R.string.action_add))
    }
}

@Composable
private fun TemplatesScreenContent(
    uiState: TemplatesUiState,
    onEvent: (TemplatesUiEvent) -> Unit,
    innerPadding: PaddingValues
) {
    when (uiState) {
        TemplatesUiState.Loading -> TemplatesLoading(modifier = Modifier.padding(innerPadding))
        TemplatesUiState.Error -> {
            TemplatesError(
                onRetry = { onEvent(TemplatesUiEvent.RetryClicked) },
                modifier = Modifier.padding(innerPadding)
            )
        }
        is TemplatesUiState.Content -> {
            TemplatesContent(
                state = uiState,
                onEvent = onEvent,
                modifier = Modifier.padding(innerPadding)
            )
        }
    }
}

@Composable
private fun TemplatesLoading(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        CircularProgressIndicator()
    }
}

@Composable
private fun TemplatesError(onRetry: () -> Unit, modifier: Modifier = Modifier) {
    Column(
        modifier =
        modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = stringResource(id = R.string.templates_error),
            style = MaterialTheme.typography.bodyLarge
        )
        Button(
            onClick = onRetry,
            modifier = Modifier.padding(top = 16.dp)
        ) {
            Text(text = stringResource(id = R.string.home_retry))
        }
    }
}

@Composable
private fun TemplatesContent(
    state: TemplatesUiState.Content,
    onEvent: (TemplatesUiEvent) -> Unit,
    modifier: Modifier = Modifier
) {
    var editRoutineTarget by remember { mutableStateOf<RoutineTemplateDto?>(null) }
    var editChoreTarget by remember { mutableStateOf<ChoreTemplateDto?>(null) }
    var routineDeleteTarget by remember { mutableStateOf<RoutineTemplateDto?>(null) }
    var choreDeleteTarget by remember { mutableStateOf<ChoreTemplateDto?>(null) }

    TemplatesList(
        state = state,
        onEvent = onEvent,
        onEditRoutine = { editRoutineTarget = it },
        onEditChore = { editChoreTarget = it },
        onDeleteRoutine = { routineDeleteTarget = it },
        onDeleteChore = { choreDeleteTarget = it },
        modifier = modifier
    )

    TemplatesDialogs(
        state = state,
        onEvent = onEvent,
        editRoutineTarget = editRoutineTarget,
        onEditRoutineDismiss = { editRoutineTarget = null },
        editChoreTarget = editChoreTarget,
        onEditChoreDismiss = { editChoreTarget = null },
        routineDeleteTarget = routineDeleteTarget,
        onRoutineDeleteDismiss = { routineDeleteTarget = null },
        choreDeleteTarget = choreDeleteTarget,
        onChoreDeleteDismiss = { choreDeleteTarget = null }
    )
}
