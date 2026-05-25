@file:Suppress("ktlint:standard:function-naming", "FunctionNaming")

package com.daynest.android.feature.wear

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.daynest.android.R
import com.daynest.android.ui.theme.DaynestTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class WearCompanionActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            DaynestTheme {
                WearCompanionRoute()
            }
        }
    }
}

@Composable
private fun WearCompanionRoute(viewModel: WearCompanionViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    WearCompanionScreen(uiState = uiState, onRefresh = viewModel::refresh, onComplete = viewModel::complete)
}

@Composable
private fun WearCompanionScreen(
    uiState: WearCompanionUiState,
    onRefresh: () -> Unit,
    onComplete: (WearDueItem) -> Unit,
) {
    when (uiState) {
        WearCompanionUiState.Loading ->
            Column(
                modifier = Modifier.fillMaxSize().padding(16.dp),
                verticalArrangement = Arrangement.Center,
            ) {
                CircularProgressIndicator()
            }

        WearCompanionUiState.Error ->
            Column(
                modifier = Modifier.fillMaxSize().padding(16.dp),
                verticalArrangement = Arrangement.Center,
            ) {
                Text(text = stringResource(id = R.string.wear_error))
                Button(
                    onClick = onRefresh,
                    modifier = Modifier.padding(top = 12.dp),
                ) {
                    Text(text = stringResource(id = R.string.home_retry))
                }
            }

        is WearCompanionUiState.Content -> {
            val snapshot = uiState.snapshot
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                item {
                    Text(
                        text = stringResource(id = R.string.wear_title),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                    )
                }
                item {
                    Text(
                        text =
                            stringResource(
                                id = R.string.wear_completion_percent,
                                snapshot.completionPercent,
                            ),
                    )
                }
                item {
                    Text(
                        text =
                            stringResource(
                                id = R.string.wear_overdue_count,
                                snapshot.overdueCount,
                            ),
                    )
                }
                item {
                    Text(
                        text =
                            snapshot.nextMedication?.let {
                                stringResource(id = R.string.wear_next_medication, it)
                            } ?: stringResource(id = R.string.wear_next_medication_none),
                    )
                }
                if (uiState.isStale) {
                    item {
                        Text(
                            text = stringResource(id = R.string.home_stale_notice),
                            style = MaterialTheme.typography.labelSmall,
                        )
                    }
                }
                if (snapshot.dueItems.isEmpty()) {
                    item {
                        Text(text = stringResource(id = R.string.home_all_caught_up))
                    }
                } else {
                    items(snapshot.dueItems, key = { "${it.type}_${it.id}" }) { item ->
                        WearDueItemRow(item = item, onComplete = { onComplete(item) })
                    }
                }
                item {
                    TextButton(onClick = onRefresh, modifier = Modifier.fillMaxWidth()) {
                        Text(text = stringResource(id = R.string.action_refresh))
                    }
                }
            }
        }
    }
}

@Composable
private fun WearDueItemRow(
    item: WearDueItem,
    onComplete: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Column(
            modifier = Modifier.weight(1f),
        ) {
            Text(text = item.title, fontWeight = FontWeight.SemiBold)
            item.subtitle?.let {
                Text(text = it, style = MaterialTheme.typography.labelSmall)
            }
        }
        Button(onClick = onComplete) {
            Text(
                text =
                    if (item.type == WearDueItemType.MEDICATION) {
                        stringResource(id = R.string.action_take)
                    } else {
                        stringResource(id = R.string.home_action_complete)
                    },
            )
        }
    }
}
