@file:Suppress("ktlint:standard:function-naming")

package com.daynest.android.app

import androidx.compose.runtime.Composable
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.daynest.android.app.navigation.DaynestDestination
import com.daynest.android.app.session.SessionGateRoute
import com.daynest.android.feature.auth.AuthRoute
import com.daynest.android.feature.home.HomeRoute
import com.daynest.android.ui.theme.DaynestTheme

@Composable
fun DaynestApp() {
    DaynestTheme {
        val navController = rememberNavController()

        NavHost(
            navController = navController,
            startDestination = DaynestDestination.SESSION_GATE,
        ) {
            composable(route = DaynestDestination.SESSION_GATE) {
                SessionGateRoute(
                    onGoAuth = {
                        navController.navigate(DaynestDestination.AUTH) {
                            popUpTo(DaynestDestination.SESSION_GATE) { inclusive = true }
                        }
                    },
                    onGoHome = {
                        navController.navigate(DaynestDestination.HOME) {
                            popUpTo(DaynestDestination.SESSION_GATE) { inclusive = true }
                        }
                    },
                )
            }

            composable(route = DaynestDestination.AUTH) {
                AuthRoute(
                    onSignedIn = {
                        navController.navigate(DaynestDestination.HOME) {
                            popUpTo(navController.graph.findStartDestination().id) { inclusive = true }
                            launchSingleTop = true
                        }
                    },
                )
            }

            composable(route = DaynestDestination.HOME) {
                HomeRoute()
            }
        }
    }
}
