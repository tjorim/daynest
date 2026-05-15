@file:Suppress("ktlint:standard:function-naming", "FunctionNaming")

package com.daynest.android.app.navigation

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

@Composable
fun DaynestNavigationScaffold(
    currentRoute: String,
    onNavigate: (String) -> Unit,
    modifier: Modifier = Modifier,
    content: @Composable (PaddingValues) -> Unit,
) {
    Scaffold(
        modifier = modifier,
        bottomBar = {
            NavigationBar {
                daynestTopLevelDestinations.forEach { destination ->
                    NavigationBarItem(
                        selected = currentRoute == destination.route,
                        onClick = { onNavigate(destination.route) },
                        label = { Text(text = destination.label) },
                        icon = { Text(text = destination.label.take(1)) },
                    )
                }
            }
        },
        content = content,
    )
}
