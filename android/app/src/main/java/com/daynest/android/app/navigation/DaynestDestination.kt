package com.daynest.android.app.navigation

import androidx.annotation.StringRes
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ViewList
import androidx.compose.material.icons.filled.Analytics
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Checklist
import androidx.compose.material.icons.filled.LocalDining
import androidx.compose.material.icons.filled.Medication
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.ui.graphics.vector.ImageVector
import com.daynest.android.R

object DaynestDestination {
    const val SESSION_GATE = "session_gate"
    const val AUTH = "auth"
    const val HOME = "today"
    const val CALENDAR = "calendar"
    const val MEDICATION = "medication"
    const val TEMPLATES = "templates"
    const val SHOPPING = "shopping"
    const val MEAL_PLAN = "meal-plan"
    const val SHOPPING_DETAIL = "shopping/{listId}"
    const val RECURRING_GROCERIES = "shopping-recurring"
    const val STATS = "stats"
    const val SETTINGS = "settings"
    const val PRIVACY_POLICY = "privacy-policy"
    const val SEARCH = "search"
}

data class DaynestTopLevelDestination(
    val route: String,
    @param:StringRes
    val labelResId: Int,
    val icon: ImageVector
)

val daynestTopLevelDestinations =
    listOf(
        DaynestTopLevelDestination(DaynestDestination.HOME, R.string.today_title, Icons.Filled.Checklist),
        DaynestTopLevelDestination(DaynestDestination.CALENDAR, R.string.calendar_title, Icons.Filled.CalendarMonth),
        DaynestTopLevelDestination(DaynestDestination.MEDICATION, R.string.medication_title, Icons.Filled.Medication),
        DaynestTopLevelDestination(
            DaynestDestination.TEMPLATES,
            R.string.templates_title,
            Icons.AutoMirrored.Filled.ViewList
        ),
        DaynestTopLevelDestination(DaynestDestination.SHOPPING, R.string.shopping_title, Icons.Filled.ShoppingCart),
        DaynestTopLevelDestination(DaynestDestination.MEAL_PLAN, R.string.meal_plan_title, Icons.Filled.LocalDining),
        DaynestTopLevelDestination(DaynestDestination.STATS, R.string.stats_title, Icons.Filled.Analytics),
        DaynestTopLevelDestination(DaynestDestination.SETTINGS, R.string.settings_title, Icons.Filled.Settings)
    )
