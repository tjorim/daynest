package com.daynest.android.app.navigation

import androidx.annotation.StringRes
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
}

data class DaynestTopLevelDestination(val route: String, @param:StringRes val labelResId: Int)

val daynestTopLevelDestinations =
    listOf(
        DaynestTopLevelDestination(DaynestDestination.HOME, R.string.today_title),
        DaynestTopLevelDestination(DaynestDestination.CALENDAR, R.string.calendar_title),
        DaynestTopLevelDestination(DaynestDestination.MEDICATION, R.string.medication_title),
        DaynestTopLevelDestination(DaynestDestination.TEMPLATES, R.string.templates_title),
        DaynestTopLevelDestination(DaynestDestination.SHOPPING, R.string.shopping_title),
        DaynestTopLevelDestination(DaynestDestination.MEAL_PLAN, R.string.meal_plan_title),
        DaynestTopLevelDestination(DaynestDestination.STATS, R.string.stats_title),
        DaynestTopLevelDestination(DaynestDestination.SETTINGS, R.string.settings_title)
    )
