package com.daynest.android.core.auth

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import com.daynest.android.core.network.ServerUrlHolder
import dagger.hilt.android.qualifiers.ApplicationContext
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
import net.openid.appauth.ResponseTypeValues
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONException
import org.json.JSONObject
import java.io.IOException
import javax.inject.Inject
import javax.inject.Named
import javax.inject.Singleton
import kotlin.coroutines.resume

@Singleton
class OidcAuthService
    @Inject
    constructor(
        @param:ApplicationContext private val context: Context,
        private val securePreferences: SharedPreferences,
        private val serverUrlHolder: ServerUrlHolder,
        @Named("discovery") private val discoveryClient: OkHttpClient,
    ) {
        private val authorizationService = AuthorizationService(context)
        private val mutex = Mutex()

        @Volatile private var authState: AuthState = loadPersistedState()

        @Volatile private var serviceConfiguration: AuthorizationServiceConfiguration? = null

        val isAuthorized: Boolean get() = authState.isAuthorized
        val currentAccessToken: String? get() = authState.accessToken

        suspend fun buildSignInIntent(): Intent {
            val config = discoverServiceConfiguration()
            val request =
                AuthorizationRequest
                    .Builder(
                        config,
                        OidcConfig.clientId,
                        ResponseTypeValues.CODE,
                        OidcConfig.redirectUri,
                    ).setScopes(OidcConfig.scopes)
                    .build()
            return authorizationService.getAuthorizationRequestIntent(request)
        }

        suspend fun handleAuthorizationResult(
            resultCode: Int,
            data: Intent?,
        ): Boolean {
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

        suspend fun getFreshAccessToken(): String? =
            mutex.withLock {
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
            val url = "${serverUrlHolder.currentUrl.trimEnd('/')}/$OIDC_CONFIG_PATH"
            val config =
                withContext(Dispatchers.IO) {
                    val request = Request.Builder().url(url).build()
                    discoveryClient.newCall(request).execute().use { response ->
                        val body = response.body.string()
                        if (!response.isSuccessful) {
                            throw IOException(
                                "OIDC config endpoint returned HTTP ${response.code} ${response.message}: $body",
                            )
                        }
                        if (body.isBlank()) {
                            throw IOException("Empty response from OIDC config endpoint")
                        }
                        parseServiceConfiguration(body)
                    }
                }
            serviceConfiguration = config
            return config
        }

        private fun parseServiceConfiguration(body: String): AuthorizationServiceConfiguration =
            try {
                val json = JSONObject(body)
                AuthorizationServiceConfiguration(
                    Uri.parse(json.getString("authorization_url")),
                    Uri.parse(json.getString("token_url")),
                )
            } catch (e: JSONException) {
                throw IOException("Failed to parse OIDC config response", e)
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
            private const val OIDC_CONFIG_PATH = "api/v1/auth/oidc-config"
        }
    }
