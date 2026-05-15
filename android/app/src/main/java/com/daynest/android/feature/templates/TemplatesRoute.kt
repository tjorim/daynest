@file:Suppress("ktlint:standard:function-naming", "FunctionNaming")

package com.daynest.android.feature.templates

import androidx.compose.runtime.Composable
import com.daynest.android.R
import com.daynest.android.app.navigation.DaynestDestination
import com.daynest.android.app.navigation.DaynestParityRoute

@Composable
fun TemplatesRoute(onNavigate: (String) -> Unit = {}) {
    DaynestParityRoute(
        currentRoute = DaynestDestination.TEMPLATES,
        onNavigate = onNavigate,
        titleRes = R.string.templates_title,
        subtitleRes = R.string.templates_subtitle,
        capabilityResIds =
            listOf(
                R.string.templates_capability_routines,
                R.string.templates_capability_chores,
                R.string.templates_capability_recurring,
            ),
    )
}
