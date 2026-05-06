package com.daynest.android.core.network

import com.daynest.android.core.storage.SecureTokenStorage
import com.daynest.android.data.auth.AuthRepository
import dagger.Lazy
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import okhttp3.Authenticator
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TokenAuthenticator
    @Inject
    constructor(
        private val storage: SecureTokenStorage,
        private val authRepository: Lazy<AuthRepository>,
    ) : Authenticator {
        private val mutex = Mutex()

        @Suppress("ReturnCount")
        override fun authenticate(
            route: Route?,
            response: Response,
        ): Request? {
            // Already retried once — refresh did not help, sign the user out
            if (response.priorResponse != null) {
                runBlocking { authRepository.get().signOut() }
                return null
            }

            // No Authorization header on the failed request — nothing to refresh
            val authHeader = response.request.header("Authorization") ?: return null
            val failedToken = authHeader.removePrefix("Bearer ").trim()

            return runBlocking {
                mutex.withLock {
                    val currentToken = storage.cachedToken
                    if (!currentToken.isNullOrBlank() && currentToken != failedToken) {
                        // Another thread already refreshed the token; retry with the new one
                        response.request
                            .newBuilder()
                            .header("Authorization", "Bearer $currentToken")
                            .build()
                    } else {
                        val newToken = authRepository.get().refreshAccessToken()
                        if (newToken != null) {
                            response.request
                                .newBuilder()
                                .header("Authorization", "Bearer $newToken")
                                .build()
                        } else {
                            // refreshAccessToken already called signOut on failure
                            null
                        }
                    }
                }
            }
        }
    }
