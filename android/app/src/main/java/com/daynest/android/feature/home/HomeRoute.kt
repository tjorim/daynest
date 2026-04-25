package com.daynest.android.feature.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.daynest.android.R

@Composable
fun HomeRoute(
    viewModel: HomeViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    HomeScreen(
        uiState = uiState,
        onEvent = viewModel::onEvent,
    )
}

@Composable
internal fun HomeScreen(
    uiState: HomeUiState,
    onEvent: (HomeUiEvent) -> Unit,
) {
    Scaffold(modifier = Modifier.fillMaxSize()) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            when (val state = uiState) {
                HomeUiState.Loading -> {
                    CircularProgressIndicator()
                }

                is HomeUiState.Content -> {
                    Text(
                        text = stringResource(id = R.string.home_welcome),
                        style = MaterialTheme.typography.headlineMedium,
                    )
                    Text(
                        text = pluralStringResource(
                            id = R.plurals.home_items_remaining,
                            count = state.summary.remainingCount,
                            state.summary.remainingCount,
                        ),
                        modifier = Modifier.padding(top = 12.dp),
                        style = MaterialTheme.typography.bodyLarge,
                    )
                    Button(
                        onClick = { onEvent(HomeUiEvent.OpenTodayDetailsClicked) },
                        modifier = Modifier.padding(top = 20.dp),
                    ) {
                        Text(
                            text = if (state.summary.isCaughtUp) {
                                stringResource(id = R.string.home_action_caught_up)
                            } else {
                                stringResource(id = R.string.home_action_plan_today)
                            },
                        )
                    }
                }

                is HomeUiState.Error -> {
                    Text(
                        text = when (state.error) {
                            HomeError.LoadTodayFailed -> stringResource(id = R.string.home_error_generic)
                        },
                        style = MaterialTheme.typography.bodyLarge,
                    )
                    Button(
                        onClick = { onEvent(HomeUiEvent.RetryClicked) },
                        modifier = Modifier.padding(top = 20.dp),
                    ) {
                        Text(text = stringResource(id = R.string.home_retry))
                    }
                }
            }
        }
    }
}
