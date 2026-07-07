@file:Suppress("ktlint:standard:function-naming", "FunctionNaming")

package com.daynest.android.app.navigation

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import com.daynest.android.R

val LocalOnOpenSearch = compositionLocalOf<() -> Unit> { {} }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DaynestNavigationScaffold(
    currentRoute: String,
    onNavigate: (String) -> Unit,
    modifier: Modifier = Modifier,
    floatingActionButton: @Composable (() -> Unit)? = null,
    snackbarHostState: SnackbarHostState? = null,
    content: @Composable (PaddingValues) -> Unit
) {
    val onOpenSearch = LocalOnOpenSearch.current
    val searchLabel = stringResource(id = R.string.app_search)

    Scaffold(
        modifier = modifier,
        topBar = {
            TopAppBar(
                title = {},
                actions = {
                    IconButton(onClick = onOpenSearch) {
                        Icon(
                            imageVector = Icons.Filled.Search,
                            contentDescription = searchLabel
                        )
                    }
                }
            )
        },
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
                        icon = {
                            Icon(
                                imageVector = destination.icon,
                                contentDescription = label
                            )
                        }
                    )
                }
            }
        },
        content = content
    )
}
