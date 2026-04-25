package com.daynest.android.data.auth

import com.daynest.android.core.storage.SecureTokenStorage
import javax.inject.Inject
import javax.inject.Singleton
import retrofit2.HttpException

@Singleton
class AuthRepository @Inject constructor(
    private val authApi: AuthApi,
    private val secureTokenStorage: SecureTokenStorage,
) {
    suspend fun signIn(email: String, password: String): Boolean {
        val session = authApi.signIn(
            request = SignInRequestDto(
                email = email,
                password = password,
            ),
        )
        secureTokenStorage.saveToken(session.accessToken)
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
        } catch (exception: Exception) {
            if (exception is HttpException && exception.code() == 401) {
                secureTokenStorage.clearToken()
            }
            false
        }
    }
}
