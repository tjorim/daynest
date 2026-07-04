package com.daynest.android.core.storage

import android.content.SharedPreferences
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SecureSessionStore @Inject constructor(private val securePreferences: SharedPreferences) {
    fun readAuthStateJson(): String? = securePreferences.getString(KEY_AUTH_STATE, null)

    fun writeAuthStateJson(value: String) {
        securePreferences.edit().putString(KEY_AUTH_STATE, value).apply()
    }

    fun clear() {
        securePreferences.edit().remove(KEY_AUTH_STATE).apply()
    }

    private companion object {
        const val KEY_AUTH_STATE = "oidc_auth_state"
    }
}
