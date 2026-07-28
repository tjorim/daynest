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
    fun onEvent(event: SettingsUiEvent) {
        when (event) {
            SettingsUiEvent.SignOutClicked -> signOut()
            SettingsUiEvent.SignOutFlowFinished -> completeSignOut()
            else -> Unit
        }
    }

    /**
     * @param awaitProviderFlow whether to keep the local session until the
     *   provider end-session activity returns. False when the account is
     *   already gone server-side and there is nothing left to keep.
     */
    @Suppress("TooGenericExceptionCaught")
    fun signOut(unregisterPushEndpoints: Boolean = true, awaitProviderFlow: Boolean = true) {
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
            if (endSessionIntent != null && awaitProviderFlow) {
                // Local state stays until the provider flow returns. Clearing it
                // here would navigate away while the browser is still opening,
                // and would report "signed out" even if the provider session
                // survived — the next sign-in would then complete with no
                // credential prompt.
                signOutIntent.emit(endSessionIntent)
            } else {
                if (endSessionIntent != null) signOutIntent.emit(endSessionIntent)
                completeSignOut()
            }
        }
    }

    /**
     * Finishes a sign-out once the provider end-session flow returns. Runs for
     * every outcome, including cancellation: ending the local session is not
     * negotiable, only the provider's half can fail.
     */
    fun completeSignOut() {
        oidcAuthService.signOut()
        uiState.value = SettingsUiState.SignedOut
    }
}
