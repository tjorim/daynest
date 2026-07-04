package com.daynest.android.core.network

import com.daynest.android.core.auth.OidcAuthService
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import okhttp3.Authenticator
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route

@Singleton
class TokenAuthenticator
@Inject
constructor(private val oidcAuthService: OidcAuthService) : Authenticator {
    private val mutex = Mutex()

    @Suppress("ReturnCount")
    override fun authenticate(route: Route?, response: Response): Request? {
        if (response.priorResponse != null) return null
        val authHeader = response.request.header("Authorization") ?: return null
        val failedToken = authHeader.removePrefix("Bearer ").trim()

        return runBlocking {
            mutex.withLock {
                val currentToken = oidcAuthService.currentAccessToken
                if (!currentToken.isNullOrBlank() && currentToken != failedToken) {
                    response.request
                        .newBuilder()
                        .header("Authorization", "Bearer $currentToken")
                        .build()
                } else {
                    val freshToken = oidcAuthService.getFreshAccessToken()
                    freshToken?.let { token ->
                        response.request
                            .newBuilder()
                            .header("Authorization", "Bearer $token")
                            .build()
                    }
                }
            }
        }
    }
}
