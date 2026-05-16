package com.daynest.android.core.auth

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import net.openid.appauth.AuthState
import net.openid.appauth.AuthorizationException
import net.openid.appauth.AuthorizationRequest
import net.openid.appauth.AuthorizationResponse
import net.openid.appauth.AuthorizationService
import net.openid.appauth.AuthorizationServiceConfiguration
import net.openid.appauth.ResponseTypeValues
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

@Singleton
class OidcAuthService @Inject constructor(
    @ApplicationContext private val context: Context,
    private val securePreferences: SharedPreferences,
) {
    private val authorizationService = AuthorizationService(context)
    private val mutex = Mutex()

    @Volatile private var authState: AuthState = loadPersistedState()
    @Volatile private var serviceConfiguration: AuthorizationServiceConfiguration? = null

    val isAuthorized: Boolean get() = authState.isAuthorized
    val currentAccessToken: String? get() = authState.accessToken

    suspend fun buildSignInIntent(): Intent {
        val config = discoverServiceConfiguration()
        val request = AuthorizationRequest.Builder(
            config,
            OidcConfig.clientId,
            ResponseTypeValues.CODE,
            OidcConfig.redirectUri,
        ).setScopes(OidcConfig.scopes).build()
        return authorizationService.getAuthorizationRequestIntent(request)
    }

    suspend fun handleAuthorizationResult(resultCode: Int, data: Intent?): Boolean {
        val response = if (resultCode == Activity.RESULT_OK && data != null) {
            AuthorizationResponse.fromIntent(data)
        } else null
        val exception = data?.let { AuthorizationException.fromIntent(it) }
        if (response == null || exception != null) return false
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

    fun signOut() = clearState()

    private suspend fun discoverServiceConfiguration(): AuthorizationServiceConfiguration {
        serviceConfiguration?.let { return it }
        return suspendCancellableCoroutine { cont ->
            AuthorizationServiceConfiguration.fetchFromIssuer(OidcConfig.issuerUri) { config, ex ->
                if (config != null) {
                    serviceConfiguration = config
                    cont.resume(config)
                } else {
                    cont.resumeWithException(ex ?: IllegalStateException("OIDC discovery failed"))
                }
            }
        }
    }

    private fun loadPersistedState(): AuthState {
        val json = securePreferences.getString(KEY_AUTH_STATE, null) ?: return AuthState()
        return runCatching { AuthState.jsonDeserialize(json) }.getOrElse { AuthState() }
    }

    private fun persistState(state: AuthState) {
        authState = state
        securePreferences.edit().putString(KEY_AUTH_STATE, state.jsonSerializeString()).apply()
    }

    private fun clearState() {
        authState = AuthState()
        securePreferences.edit().remove(KEY_AUTH_STATE).apply()
    }

    companion object {
        private const val KEY_AUTH_STATE = "oidc_auth_state"
    }
}
