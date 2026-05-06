package com.daynest.android.data.auth

import com.daynest.android.core.storage.SecureTokenStorage
import kotlinx.coroutines.CancellationException
import retrofit2.HttpException
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

private const val HTTP_UNAUTHORIZED = 401

@Singleton
class AuthRepository
    @Inject
    constructor(
        private val authApi: AuthApi,
        private val secureTokenStorage: SecureTokenStorage,
    ) {
        suspend fun signIn(
            email: String,
            password: String,
        ): Boolean {
            val session =
                authApi.signIn(
                    request =
                        SignInRequestDto(
                            email = email,
                            password = password,
                        ),
                )
            secureTokenStorage.saveToken(session.accessToken)
            session.refreshToken?.let { secureTokenStorage.saveRefreshToken(it) }
            return true
        }

        suspend fun hasValidSession(): Boolean {
            val persistedToken = secureTokenStorage.getToken().orEmpty()
            if (persistedToken.isBlank()) {
                return false
            }

            return try {
                val refreshed = authApi.restoreSession()
                secureTokenStorage.saveToken(refreshed.accessToken)
                true
            } catch (exception: HttpException) {
                if (exception.code() == HTTP_UNAUTHORIZED) {
                    secureTokenStorage.clearToken()
                }
                false
            } catch (exception: CancellationException) {
                throw exception
            } catch (_: IOException) {
                false
            } catch (_: Exception) {
                false
            }
        }

        suspend fun refreshAccessToken(): String? {
            val refreshToken = secureTokenStorage.getRefreshToken() ?: return null
            return try {
                val session = authApi.refresh(RefreshRequestDto(refreshToken))
                secureTokenStorage.saveToken(session.accessToken)
                session.refreshToken?.let { secureTokenStorage.saveRefreshToken(it) }
                session.accessToken
            } catch (exception: CancellationException) {
                throw exception
            } catch (_: Exception) {
                signOut()
                null
            }
        }

        suspend fun signOut() {
            secureTokenStorage.clearToken()
            secureTokenStorage.clearRefreshToken()
        }
    }
