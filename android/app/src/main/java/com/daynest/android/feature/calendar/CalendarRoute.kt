@file:Suppress("ktlint:standard:function-naming", "FunctionNaming")

package com.daynest.android.feature.calendar

import androidx.compose.runtime.Composable
import com.daynest.android.R
import com.daynest.android.app.navigation.DaynestDestination
import com.daynest.android.app.navigation.DaynestParityRoute

@Composable
fun CalendarRoute(onNavigate: (String) -> Unit = {}) {
    DaynestParityRoute(
        currentRoute = DaynestDestination.CALENDAR,
        onNavigate = onNavigate,
        titleRes = R.string.calendar_title,
        subtitleRes = R.string.calendar_subtitle,
        capabilityResIds =
            listOf(
                R.string.calendar_capability_month,
                R.string.calendar_capability_day,
                R.string.calendar_capability_planned,
                R.string.calendar_capability_backup,
            ),
    )
}
