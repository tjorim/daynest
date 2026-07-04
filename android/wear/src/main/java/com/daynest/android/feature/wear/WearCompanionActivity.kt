@file:Suppress("ktlint:standard:function-naming", "FunctionNaming")

package com.daynest.android.feature.wear

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.material.Chip
import androidx.wear.compose.material.CircularProgressIndicator
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import com.daynest.android.R
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class WearCompanionActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Box(
                    modifier =
                    Modifier
                        .fillMaxSize()
                        .background(Color.Black)
                ) {
                    WearCompanionRoute()
                }
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
    onComplete: (WearDueItem) -> Unit
) {
    when (uiState) {
        WearCompanionUiState.Loading -> WearLoadingContent()

        WearCompanionUiState.Error -> WearErrorContent(onRefresh = onRefresh)

        is WearCompanionUiState.Content ->
            WearContentList(
                uiState = uiState,
                onRefresh = onRefresh,
                onComplete = onComplete
            )
    }
}

@Composable
private fun WearLoadingContent() {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        CircularProgressIndicator()
    }
}

@Composable
private fun WearErrorContent(onRefresh: () -> Unit) {
    Column(
        modifier =
        Modifier
            .fillMaxSize()
            .padding(horizontal = 24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(text = stringResource(id = R.string.wear_error))
        Chip(
            onClick = onRefresh,
            label = { Text(text = stringResource(id = R.string.home_retry)) },
            modifier =
            Modifier
                .fillMaxWidth()
                .padding(top = 12.dp)
        )
    }
}

@Composable
private fun WearContentList(
    uiState: WearCompanionUiState.Content,
    onRefresh: () -> Unit,
    onComplete: (WearDueItem) -> Unit
) {
    ScalingLazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 28.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        item { WearSummary(snapshot = uiState.snapshot) }
        if (uiState.isStale) {
            item { WearStaleNotice() }
        }
        if (uiState.snapshot.dueItems.isEmpty()) {
            item { Text(text = stringResource(id = R.string.home_all_caught_up)) }
        } else {
            items(uiState.snapshot.dueItems, key = { "${it.type}_${it.id}" }) { item ->
                WearDueItemRow(item = item, onComplete = { onComplete(item) })
            }
        }
        item {
            Chip(
                onClick = onRefresh,
                label = { Text(text = stringResource(id = R.string.action_refresh)) },
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

@Composable
private fun WearSummary(snapshot: WearTodaySnapshot) {
    Text(
        text = stringResource(id = R.string.wear_title),
        style = MaterialTheme.typography.title3,
        fontWeight = FontWeight.Bold
    )
    Text(
        text =
        stringResource(
            id = R.string.wear_completion_percent,
            snapshot.completionPercent
        )
    )
    Text(
        text =
        stringResource(
            id = R.string.wear_overdue_count,
            snapshot.overdueCount
        )
    )
    Text(
        text =
        snapshot.nextMedication?.let {
            stringResource(id = R.string.wear_next_medication, it)
        } ?: stringResource(id = R.string.wear_next_medication_none)
    )
}

@Composable
private fun WearStaleNotice() {
    Text(
        text = stringResource(id = R.string.home_stale_notice),
        style = MaterialTheme.typography.caption2
    )
}

@Composable
private fun WearDueItemRow(item: WearDueItem, onComplete: () -> Unit) {
    val actionText =
        if (item.type == WearDueItemType.MEDICATION) {
            stringResource(id = R.string.action_take)
        } else {
            stringResource(id = R.string.home_action_complete)
        }
    Chip(
        onClick = onComplete,
        label = {
            Text(text = item.title, fontWeight = FontWeight.SemiBold)
        },
        secondaryLabel = {
            Text(
                text = item.subtitle ?: actionText,
                style = MaterialTheme.typography.caption2
            )
        },
        modifier = Modifier.fillMaxWidth()
    )
}
