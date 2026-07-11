package com.daynest.android.feature.settings

import android.content.Intent
import com.daynest.android.core.auth.OidcAuthService
import com.daynest.android.data.push.PushRegistrationManager
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch

internal class SettingsSignOutHandler(
    private val scope: CoroutineScope,
    private val oidcAuthService: OidcAuthService,
    private val pushRegistrationManager: PushRegistrationManager,
    private val uiState: MutableStateFlow<SettingsUiState>,
    private val signOutIntent: MutableSharedFlow<Intent>
) {
    @Suppress("TooGenericExceptionCaught")
    fun signOut(unregisterPushEndpoints: Boolean = true) {
        scope.launch {
            if (unregisterPushEndpoints) {
                try {
                    pushRegistrationManager.unregisterAllKnownEndpoints()
                } catch (e: Exception) {
                    if (e is CancellationException) throw e
                }
            }
            val endSessionIntent =
                try {
                    oidcAuthService.buildSignOutIntent()
                } catch (e: Exception) {
                    if (e is CancellationException) throw e
                    null
                }
            if (endSessionIntent != null) {
                signOutIntent.emit(endSessionIntent)
            } else {
                oidcAuthService.signOut()
            }
            uiState.value = SettingsUiState.SignedOut
        }
    }
}
