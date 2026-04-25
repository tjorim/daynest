package com.daynest.android.app

import androidx.compose.runtime.Composable
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.daynest.android.feature.home.HomeRoute
import com.daynest.android.ui.theme.DaynestTheme

@Composable
fun DaynestApp() {
    DaynestTheme {
        val navController = rememberNavController()

        NavHost(
            navController = navController,
            startDestination = "home",
        ) {
            composable(route = "home") {
                HomeRoute()
            }
        }
    }
}
