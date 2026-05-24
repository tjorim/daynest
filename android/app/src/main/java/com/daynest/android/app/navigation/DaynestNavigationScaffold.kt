@file:Suppress("ktlint:standard:function-naming", "FunctionNaming")

package com.daynest.android.app.navigation

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource

@Composable
fun DaynestNavigationScaffold(
    currentRoute: String,
    onNavigate: (String) -> Unit,
    modifier: Modifier = Modifier,
    floatingActionButton: @Composable (() -> Unit)? = null,
    snackbarHostState: SnackbarHostState? = null,
    content: @Composable (PaddingValues) -> Unit,
) {
    Scaffold(
        modifier = modifier,
        floatingActionButton = { floatingActionButton?.invoke() },
        snackbarHost = {
            snackbarHostState?.let { SnackbarHost(hostState = it) }
        },
        bottomBar = {
            NavigationBar {
                daynestTopLevelDestinations.forEach { destination ->
                    val label = stringResource(id = destination.labelResId)
                    NavigationBarItem(
                        selected = currentRoute == destination.route,
                        onClick = { onNavigate(destination.route) },
                        label = { Text(text = label) },
                        icon = { Text(text = label.take(1)) },
                    )
                }
            }
        },
        content = content,
    )
}
