package com.daynest.android.core.storage

import android.content.SharedPreferences
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@Singleton
class EncryptedTokenStorage @Inject constructor(
    private val sharedPreferences: SharedPreferences,
) : SecureTokenStorage {

    override suspend fun getToken(): String? = withContext(Dispatchers.IO) {
        sharedPreferences.getString(KEY_TOKEN, null)
    }

    override suspend fun saveToken(token: String) {
        withContext(Dispatchers.IO) {
            sharedPreferences.edit().putString(KEY_TOKEN, token).apply()
        }
    }

    override suspend fun clearToken() {
        withContext(Dispatchers.IO) {
            sharedPreferences.edit().remove(KEY_TOKEN).apply()
        }
    }

    private companion object {
        const val KEY_TOKEN = "auth_token"
    }
}
