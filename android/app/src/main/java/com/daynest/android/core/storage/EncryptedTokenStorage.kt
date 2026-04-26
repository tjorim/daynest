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

        override val cachedToken: String? get() = _cachedToken

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

        private companion object {
            const val KEY_TOKEN = "auth_token"
        }
    }
