package com.daynest.android.fakes

import com.daynest.android.core.storage.SecureTokenStorage

internal class FakeSecureTokenStorage(
    initialToken: String? = null,
) : SecureTokenStorage {
    private var storedToken: String? = initialToken

    override val cachedToken: String?
        get() = storedToken

    override suspend fun getToken(): String? = storedToken

    override suspend fun saveToken(token: String) {
        storedToken = token
    }

    override suspend fun clearToken() {
        storedToken = null
    }
}
