package com.daynest.android.core.storage.preferences

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class UserPreferencesRepository
    @Inject
    constructor(
        private val dataStore: DataStore<Preferences>,
    ) {
        val preferences: Flow<UserPreferences> =
            dataStore.data.map { prefs ->
                UserPreferences(
                    lastTodayFetchEpochMillis = prefs[LAST_TODAY_FETCH] ?: 0L,
                    customServerUrl = prefs[CUSTOM_SERVER_URL],
                    biometricLockEnabled = prefs[BIOMETRIC_LOCK_ENABLED] ?: false,
                    biometricIdleTimeoutMinutes = prefs[BIOMETRIC_IDLE_TIMEOUT_MINUTES] ?: 5,
                    pushNotificationsEnabled = prefs[PUSH_NOTIFICATIONS_ENABLED] ?: true,
                    calendarSyncEnabled = prefs[CALENDAR_SYNC_ENABLED] ?: false,
                    lastBackgroundEpochMillis = prefs[LAST_BACKGROUND_EPOCH_MILLIS] ?: 0L,
                )
            }

        suspend fun updateLastTodayFetch(epochMillis: Long) {
            dataStore.edit { prefs ->
                prefs[LAST_TODAY_FETCH] = epochMillis
            }
        }

        suspend fun updateCustomServerUrl(url: String?) {
            dataStore.edit { prefs ->
                if (url != null) {
                    prefs[CUSTOM_SERVER_URL] = url
                } else {
                    prefs.remove(CUSTOM_SERVER_URL)
                }
            }
        }

        suspend fun updateBiometricLockEnabled(enabled: Boolean) {
            dataStore.edit { prefs ->
                prefs[BIOMETRIC_LOCK_ENABLED] = enabled
            }
        }

        suspend fun updateBiometricIdleTimeoutMinutes(timeoutMinutes: Int) {
            dataStore.edit { prefs ->
                prefs[BIOMETRIC_IDLE_TIMEOUT_MINUTES] = timeoutMinutes.coerceIn(1, 240)
            }
        }

        suspend fun updatePushNotificationsEnabled(enabled: Boolean) {
            dataStore.edit { prefs ->
                prefs[PUSH_NOTIFICATIONS_ENABLED] = enabled
            }
        }

        suspend fun updateCalendarSyncEnabled(enabled: Boolean) {
            dataStore.edit { prefs ->
                prefs[CALENDAR_SYNC_ENABLED] = enabled
            }
        }

        suspend fun updateLastBackgroundEpochMillis(epochMillis: Long) {
            dataStore.edit { prefs ->
                prefs[LAST_BACKGROUND_EPOCH_MILLIS] = epochMillis
            }
        }

        private companion object {
            val LAST_TODAY_FETCH = longPreferencesKey("last_today_fetch_epoch_millis")
            val CUSTOM_SERVER_URL = stringPreferencesKey("custom_server_url")
            val BIOMETRIC_LOCK_ENABLED = booleanPreferencesKey("biometric_lock_enabled")
            val BIOMETRIC_IDLE_TIMEOUT_MINUTES = intPreferencesKey("biometric_idle_timeout_minutes")
            val PUSH_NOTIFICATIONS_ENABLED = booleanPreferencesKey("push_notifications_enabled")
            val CALENDAR_SYNC_ENABLED = booleanPreferencesKey("calendar_sync_enabled")
            val LAST_BACKGROUND_EPOCH_MILLIS = longPreferencesKey("last_background_epoch_millis")
        }
    }
