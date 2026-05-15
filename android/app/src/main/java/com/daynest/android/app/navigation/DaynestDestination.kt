package com.daynest.android.app.navigation

object DaynestDestination {
    const val SESSION_GATE = "session_gate"
    const val AUTH = "auth"
    const val HOME = "today"
    const val CALENDAR = "calendar"
    const val MEDICATION = "medication"
    const val TEMPLATES = "templates"
    const val SETTINGS = "settings"
}

data class DaynestTopLevelDestination(
    val route: String,
    val label: String,
)

val daynestTopLevelDestinations =
    listOf(
        DaynestTopLevelDestination(DaynestDestination.HOME, "Today"),
        DaynestTopLevelDestination(DaynestDestination.CALENDAR, "Calendar"),
        DaynestTopLevelDestination(DaynestDestination.MEDICATION, "Medication"),
        DaynestTopLevelDestination(DaynestDestination.TEMPLATES, "Templates"),
        DaynestTopLevelDestination(DaynestDestination.SETTINGS, "Settings"),
    )
