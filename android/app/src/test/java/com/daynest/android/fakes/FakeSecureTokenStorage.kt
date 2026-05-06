package com.daynest.android.fakes

import com.daynest.android.core.storage.SecureTokenStorage

internal class FakeSecureTokenStorage(
    initialToken: String? = null,
    initialRefreshToken: String? = null,
) : SecureTokenStorage {
    private var storedToken: String? = initialToken
    private var storedRefreshToken: String? = initialRefreshToken

    override val cachedToken: String?
        get() = storedToken

    override val cachedRefreshToken: String?
        get() = storedRefreshToken

    override suspend fun getToken(): String? = storedToken

    override suspend fun saveToken(token: String) {
        storedToken = token
    }

    override suspend fun clearToken() {
        storedToken = null
    }

    override suspend fun getRefreshToken(): String? = storedRefreshToken

    override suspend fun saveRefreshToken(token: String) {
        storedRefreshToken = token
    }

    override suspend fun clearRefreshToken() {
        storedRefreshToken = null
    }
}
