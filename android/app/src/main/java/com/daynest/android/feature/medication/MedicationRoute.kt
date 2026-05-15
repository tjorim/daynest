@file:Suppress("ktlint:standard:function-naming", "FunctionNaming")

package com.daynest.android.feature.medication

import androidx.compose.runtime.Composable
import com.daynest.android.R
import com.daynest.android.app.navigation.DaynestDestination
import com.daynest.android.app.navigation.DaynestParityRoute

@Composable
fun MedicationRoute(onNavigate: (String) -> Unit = {}) {
    DaynestParityRoute(
        currentRoute = DaynestDestination.MEDICATION,
        onNavigate = onNavigate,
        titleRes = R.string.medication_title,
        subtitleRes = R.string.medication_subtitle,
        capabilityResIds =
            listOf(
                R.string.medication_capability_today,
                R.string.medication_capability_history,
                R.string.medication_capability_strict,
            ),
    )
}
