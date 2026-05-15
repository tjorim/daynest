@file:Suppress("ktlint:standard:function-naming", "FunctionNaming")

package com.daynest.android.feature.settings

import androidx.compose.runtime.Composable
import com.daynest.android.R
import com.daynest.android.app.navigation.DaynestDestination
import com.daynest.android.app.navigation.DaynestParityRoute

@Composable
fun SettingsRoute(onNavigate: (String) -> Unit = {}) {
    DaynestParityRoute(
        currentRoute = DaynestDestination.SETTINGS,
        onNavigate = onNavigate,
        titleRes = R.string.settings_title,
        subtitleRes = R.string.settings_subtitle,
        capabilityResIds =
            listOf(
                R.string.settings_capability_account,
                R.string.settings_capability_integrations,
                R.string.settings_capability_clients,
            ),
    )
}
