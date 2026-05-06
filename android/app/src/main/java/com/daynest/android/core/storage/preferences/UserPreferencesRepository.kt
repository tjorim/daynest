package com.daynest.android.core.storage.preferences

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
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
                )
            }

        suspend fun updateLastTodayFetch(epochMillis: Long) {
            dataStore.edit { prefs ->
                prefs[LAST_TODAY_FETCH] = epochMillis
            }
        }

        private companion object {
            val LAST_TODAY_FETCH = longPreferencesKey("last_today_fetch_epoch_millis")
        }
    }
