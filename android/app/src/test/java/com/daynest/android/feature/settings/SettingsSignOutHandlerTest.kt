package com.daynest.android.feature.settings

import android.content.Intent
import com.daynest.android.core.auth.OidcAuthService
import com.daynest.android.data.push.PushRegistrationManager
import io.mockk.coEvery
import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class SettingsSignOutHandlerTest {
    private val dispatcher = StandardTestDispatcher()

    @Test
    fun `local session is kept until the provider end-session flow returns`() = runTest(dispatcher) {
        val oidcAuthService = authService(endSessionIntent = mockk<Intent>())
        val uiState = MutableStateFlow<SettingsUiState>(SettingsUiState.Loading)

        handler(this, oidcAuthService, uiState).signOut()
        advanceUntilIdle()

        // The browser is still open. Reporting "signed out" here would leave the
        // provider session alive behind a signed-out UI, and the next sign-in
        // would then complete with no credential prompt.
        assertNotEquals(SettingsUiState.SignedOut, uiState.value)
        verify(exactly = 0) { oidcAuthService.signOut() }
    }

    @Test
    fun `the local session ends once the flow returns, whatever its result`() = runTest(dispatcher) {
        val oidcAuthService = authService(endSessionIntent = mockk<Intent>())
        val uiState = MutableStateFlow<SettingsUiState>(SettingsUiState.Loading)
        val signOutHandler = handler(this, oidcAuthService, uiState)

        signOutHandler.signOut()
        advanceUntilIdle()
        signOutHandler.completeSignOut()

        assertEquals(SettingsUiState.SignedOut, uiState.value)
        verify(exactly = 1) { oidcAuthService.signOut() }
    }

    @Test
    fun `sign-out completes immediately when there is no provider flow to run`() = runTest(dispatcher) {
        val oidcAuthService = authService(endSessionIntent = null)
        val uiState = MutableStateFlow<SettingsUiState>(SettingsUiState.Loading)

        handler(this, oidcAuthService, uiState).signOut()
        advanceUntilIdle()

        assertEquals(SettingsUiState.SignedOut, uiState.value)
        verify(exactly = 1) { oidcAuthService.signOut() }
    }

    @Test
    fun `the flow-finished event completes the sign-out rather than starting another`() = runTest(dispatcher) {
        val oidcAuthService = authService(endSessionIntent = mockk<Intent>())
        val uiState = MutableStateFlow<SettingsUiState>(SettingsUiState.Loading)

        handler(this, oidcAuthService, uiState).onEvent(SettingsUiEvent.SignOutFlowFinished)
        advanceUntilIdle()

        assertEquals(SettingsUiState.SignedOut, uiState.value)
        verify(exactly = 1) { oidcAuthService.signOut() }
    }

    @Test
    fun `a deleted account does not wait for the provider flow`() = runTest(dispatcher) {
        val oidcAuthService = authService(endSessionIntent = mockk<Intent>())
        val uiState = MutableStateFlow<SettingsUiState>(SettingsUiState.Loading)

        handler(this, oidcAuthService, uiState)
            .signOut(unregisterPushEndpoints = false, awaitProviderFlow = false)
        advanceUntilIdle()

        assertEquals(SettingsUiState.SignedOut, uiState.value)
        verify(exactly = 1) { oidcAuthService.signOut() }
    }

    private fun authService(endSessionIntent: Intent?): OidcAuthService = mockk<OidcAuthService>(relaxed = true) {
        coEvery { buildSignOutIntent() } returns endSessionIntent
    }

    private fun handler(
        scope: CoroutineScope,
        oidcAuthService: OidcAuthService,
        uiState: MutableStateFlow<SettingsUiState>
    ) = SettingsSignOutHandler(
        scope = scope,
        oidcAuthService = oidcAuthService,
        pushRegistrationManager = mockk<PushRegistrationManager>(relaxed = true),
        uiState = uiState,
        signOutIntent = MutableSharedFlow(extraBufferCapacity = 1)
    )
}
