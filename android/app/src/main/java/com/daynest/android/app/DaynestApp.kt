@file:Suppress("ktlint:standard:function-naming", "FunctionNaming")

package com.daynest.android.app

import androidx.compose.runtime.Composable
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.daynest.android.app.navigation.DaynestDestination
import com.daynest.android.app.session.BiometricGate
import com.daynest.android.app.session.SessionGateRoute
import com.daynest.android.feature.auth.AuthRoute
import com.daynest.android.feature.calendar.CalendarRoute
import com.daynest.android.feature.home.HomeRoute
import com.daynest.android.feature.legal.PrivacyPolicyRoute
import com.daynest.android.feature.mealplan.MealPlannerRoute
import com.daynest.android.feature.medication.MedicationRoute
import com.daynest.android.feature.settings.SettingsRoute
import com.daynest.android.feature.shopping.RecurringGroceriesRoute
import com.daynest.android.feature.shopping.ShoppingListDetailRoute
import com.daynest.android.feature.shopping.ShoppingListsRoute
import com.daynest.android.feature.templates.TemplatesRoute
import com.daynest.android.ui.theme.DaynestTheme

@Composable
fun DaynestApp() {
    DaynestTheme {
        val navController = rememberNavController()
        BiometricGate()

        NavHost(
            navController = navController,
            startDestination = DaynestDestination.SESSION_GATE
        ) {
            daynestDestinations(navController)
        }
    }
}

private fun NavGraphBuilder.daynestDestinations(navController: NavHostController) {
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
            }
        )
    }

    composable(route = DaynestDestination.AUTH) {
        AuthRoute(
            onSignedIn = {
                navController.navigate(DaynestDestination.HOME) {
                    popUpTo(navController.graph.findStartDestination().id) { inclusive = true }
                    launchSingleTop = true
                }
            }
        )
    }

    composable(route = DaynestDestination.HOME) {
        HomeRoute(onNavigate = navController::navigateTopLevel)
    }
    composable(route = DaynestDestination.CALENDAR) {
        CalendarRoute(onNavigate = navController::navigateTopLevel)
    }
    composable(route = DaynestDestination.MEDICATION) {
        MedicationRoute(onNavigate = navController::navigateTopLevel)
    }
    composable(route = DaynestDestination.TEMPLATES) {
        TemplatesRoute(onNavigate = navController::navigateTopLevel)
    }
    shoppingDestinations(navController)
    composable(route = DaynestDestination.MEAL_PLAN) {
        MealPlannerRoute(onNavigate = navController::navigateTopLevel)
    }
    composable(route = DaynestDestination.SETTINGS) {
        SettingsRoute(
            onNavigate = navController::navigateTopLevel,
            onOpenPrivacyPolicy = { navController.navigate(DaynestDestination.PRIVACY_POLICY) },
            onSignedOut = {
                navController.navigate(DaynestDestination.AUTH) {
                    popUpTo(DaynestDestination.HOME) { inclusive = true }
                    launchSingleTop = true
                }
            }
        )
    }
    composable(route = DaynestDestination.PRIVACY_POLICY) {
        PrivacyPolicyRoute(onBack = { navController.popBackStack() })
    }
}

private fun NavGraphBuilder.shoppingDestinations(navController: NavHostController) {
    composable(route = DaynestDestination.SHOPPING) {
        ShoppingListsRoute(
            onNavigate = navController::navigateTopLevel,
            onOpenList = { listId -> navController.navigate("${DaynestDestination.SHOPPING}/$listId") },
            onOpenRecurringGroceries = { navController.navigate(DaynestDestination.RECURRING_GROCERIES) }
        )
    }
    composable(
        route = DaynestDestination.SHOPPING_DETAIL,
        arguments = listOf(navArgument("listId") { type = NavType.IntType })
    ) { backStackEntry ->
        val listId = requireNotNull(backStackEntry.arguments).getInt("listId")
        ShoppingListDetailRoute(
            listId = listId,
            onNavigate = navController::navigateTopLevel,
            onBack = { navController.popBackStack() }
        )
    }
    composable(route = DaynestDestination.RECURRING_GROCERIES) {
        RecurringGroceriesRoute(onBack = { navController.popBackStack() })
    }
}

private fun NavHostController.navigateTopLevel(route: String) {
    navigate(route) {
        popUpTo(DaynestDestination.HOME) {
            saveState = true
        }
        launchSingleTop = true
        restoreState = true
    }
}
