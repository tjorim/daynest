package com.daynest.android.core.storage

interface SecureTokenStorage {
    val cachedToken: String?

    suspend fun getToken(): String?

    suspend fun saveToken(token: String)

    suspend fun clearToken()
}
