@file:Suppress("ktlint:standard:function-naming", "FunctionNaming")

package com.daynest.android.app.navigation

import androidx.annotation.StringRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.daynest.android.R

@Composable
fun DaynestParityRoute(
    currentRoute: String,
    onNavigate: (String) -> Unit,
    @StringRes titleRes: Int,
    @StringRes subtitleRes: Int,
    capabilityResIds: List<Int>,
) {
    DaynestNavigationScaffold(
        currentRoute = currentRoute,
        onNavigate = onNavigate,
    ) { innerPadding ->
        LazyColumn(
            modifier =
                Modifier
                    .fillMaxSize()
                    .padding(innerPadding),
            contentPadding = PaddingValues(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            item {
                Column {
                    Text(
                        text = stringResource(id = titleRes),
                        style = MaterialTheme.typography.headlineMedium,
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = stringResource(id = subtitleRes),
                        style = MaterialTheme.typography.bodyLarge,
                    )
                }
            }
            itemsIndexed(
                capabilityResIds,
                key = { index, capabilityResId -> "capability_${capabilityResId}_$index" },
            ) { _, capabilityResId ->
                Card(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = stringResource(id = capabilityResId),
                        modifier = Modifier.padding(16.dp),
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
            }
            item {
                Text(
                    text = stringResource(id = R.string.parity_more_coming),
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }
    }
}
