package com.daynest.android.core.auth

import android.app.Activity
import android.content.Context
import android.content.Intent
import com.daynest.android.BuildConfig
import com.daynest.android.core.storage.ApiBaseUrlOverrideStore
import com.daynest.android.core.storage.SecureSessionStore
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.coroutines.resume
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import net.openid.appauth.AuthState
import net.openid.appauth.AuthorizationException
import net.openid.appauth.AuthorizationRequest
import net.openid.appauth.AuthorizationResponse
import net.openid.appauth.AuthorizationService
import net.openid.appauth.AuthorizationServiceConfiguration
import net.openid.appauth.EndSessionRequest
import net.openid.appauth.ResponseTypeValues

@Singleton
class OidcAuthService
@Inject
constructor(
    @param:ApplicationContext private val context: Context,
    private val secureSessionStore: SecureSessionStore,
    private val apiBaseUrlOverrideStore: ApiBaseUrlOverrideStore,
    private val oidcDiscovery: OidcServiceConfigurationDiscovery,
    private val oidcConfig: OidcConfig
) {
    private val authorizationService = AuthorizationService(context)
    private val mutex = Mutex()
    private val configMutex = Mutex()

    @Volatile private var authState: AuthState = loadPersistedState()

    @Volatile private var serviceConfiguration: Pair<String, AuthorizationServiceConfiguration>? = null

    val isAuthorized: Boolean get() = authState.isAuthorized
    val currentAccessToken: String? get() = authState.accessToken

    suspend fun buildSignInIntent(): Intent {
        val config = discoverServiceConfiguration()
        val request =
            AuthorizationRequest
                .Builder(
                    config,
                    oidcConfig.clientId,
                    ResponseTypeValues.CODE,
                    oidcConfig.redirectUri
                ).setScope(oidcConfig.scope)
                .build()
        return authorizationService.getAuthorizationRequestIntent(request)
    }

    suspend fun handleAuthorizationResult(resultCode: Int, data: Intent?): Boolean {
        val isOk = resultCode == Activity.RESULT_OK && data != null
        val response = data?.let { AuthorizationResponse.fromIntent(it) }
        val exception = data?.let { AuthorizationException.fromIntent(it) }
        if (!isOk || response == null || exception != null) {
            return false
        }
        return suspendCancellableCoroutine { cont ->
            authorizationService.performTokenRequest(response.createTokenExchangeRequest()) { tokenResponse, ex ->
                if (tokenResponse != null) {
                    val newState = AuthState(response, null).apply { update(tokenResponse, ex) }
                    persistState(newState)
                    cont.resume(true)
                } else {
                    cont.resume(false)
                }
            }
        }
    }

    suspend fun getFreshAccessToken(): String? = mutex.withLock {
        suspendCancellableCoroutine { cont ->
            authState.performActionWithFreshTokens(authorizationService) { accessToken, _, ex ->
                if (ex != null || accessToken == null) {
                    clearState()
                    cont.resume(null)
                } else {
                    persistState(authState)
                    cont.resume(accessToken)
                }
            }
        }
    }

    suspend fun buildSignOutIntent(): Intent? {
        val idToken = authState.idToken
        val config = discoverServiceConfiguration()
        clearState()
        if (config.endSessionEndpoint == null) return null
        val requestBuilder =
            EndSessionRequest
                .Builder(config)
                .setPostLogoutRedirectUri(oidcConfig.redirectUri)
        if (idToken != null) {
            requestBuilder.setIdTokenHint(idToken)
        }
        return authorizationService.getEndSessionRequestIntent(requestBuilder.build())
    }

    fun signOut() = clearState()

    private suspend fun discoverServiceConfiguration(): AuthorizationServiceConfiguration {
        val serverUrl = apiBaseUrlOverrideStore.override.value ?: BuildConfig.API_BASE_URL
        serviceConfiguration?.takeIf { it.first == serverUrl }?.let { return it.second }
        return configMutex.withLock {
            serviceConfiguration?.takeIf { it.first == serverUrl }?.second
                ?: withContext(Dispatchers.IO) {
                    oidcDiscovery.fetch(serverUrl)
                }.also { serviceConfiguration = serverUrl to it }
        }
    }

    private fun loadPersistedState(): AuthState {
        val json = secureSessionStore.readAuthStateJson() ?: return AuthState()
        return runCatching { AuthState.jsonDeserialize(json) }.getOrElse { AuthState() }
    }

    private fun persistState(state: AuthState) {
        authState = state
        secureSessionStore.writeAuthStateJson(state.jsonSerializeString())
    }

    private fun clearState() {
        authState = AuthState()
        secureSessionStore.clear()
    }
}
