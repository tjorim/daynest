package com.daynest.android.core.storage

interface SecureTokenStorage {
    val cachedToken: String?
    val cachedRefreshToken: String?

    suspend fun getToken(): String?

    suspend fun saveToken(token: String)

    suspend fun clearToken()

    suspend fun getRefreshToken(): String?

    suspend fun saveRefreshToken(token: String)

    suspend fun clearRefreshToken()
}
