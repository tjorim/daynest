package com.daynest.android.core.storage

import android.content.SharedPreferences
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class EncryptedTokenStorage
    @Inject
    constructor(
        private val sharedPreferences: SharedPreferences,
    ) : SecureTokenStorage {
        @Volatile private var _cachedToken: String? = sharedPreferences.getString(KEY_TOKEN, null)

        @Volatile private var _cachedRefreshToken: String? = sharedPreferences.getString(KEY_REFRESH_TOKEN, null)

        override val cachedToken: String? get() = _cachedToken

        override val cachedRefreshToken: String? get() = _cachedRefreshToken

        override suspend fun getToken(): String? =
            withContext(Dispatchers.IO) {
                sharedPreferences.getString(KEY_TOKEN, null)
            }

        override suspend fun saveToken(token: String) {
            _cachedToken = token
            withContext(Dispatchers.IO) {
                sharedPreferences.edit().putString(KEY_TOKEN, token).apply()
            }
        }

        override suspend fun clearToken() {
            _cachedToken = null
            withContext(Dispatchers.IO) {
                sharedPreferences.edit().remove(KEY_TOKEN).apply()
            }
        }

        override suspend fun getRefreshToken(): String? =
            withContext(Dispatchers.IO) {
                sharedPreferences.getString(KEY_REFRESH_TOKEN, null)
            }

        override suspend fun saveRefreshToken(token: String) {
            _cachedRefreshToken = token
            withContext(Dispatchers.IO) {
                sharedPreferences.edit().putString(KEY_REFRESH_TOKEN, token).apply()
            }
        }

        override suspend fun clearRefreshToken() {
            _cachedRefreshToken = null
            withContext(Dispatchers.IO) {
                sharedPreferences.edit().remove(KEY_REFRESH_TOKEN).apply()
            }
        }

        private companion object {
            const val KEY_TOKEN = "auth_token"
            const val KEY_REFRESH_TOKEN = "auth_refresh_token"
        }
    }
