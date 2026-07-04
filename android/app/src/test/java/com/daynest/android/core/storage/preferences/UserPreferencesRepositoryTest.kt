package com.daynest.android.core.storage.preferences

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.emptyPreferences
import app.cash.turbine.test
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test

class UserPreferencesRepositoryTest {
    private val fakeDataStore = FakePreferencesDataStore()
    private val repository = UserPreferencesRepository(fakeDataStore)

    @Test
    fun `preferences emits default value when no data stored`() =
        runTest {
            repository.preferences.test {
                val prefs = awaitItem()
                assertEquals(0L, prefs.lastTodayFetchEpochMillis)
                assertEquals(false, prefs.biometricLockEnabled)
                assertEquals(5, prefs.biometricIdleTimeoutMinutes)
                assertEquals(true, prefs.pushNotificationsEnabled)
                assertEquals(false, prefs.calendarSyncEnabled)
                assertEquals(false, prefs.showDeviceCalendars)
                assertEquals(emptySet<String>(), prefs.enabledDeviceCalendarIds)
                cancelAndIgnoreRemainingEvents()
            }
        }

    @Test
    fun `updateLastTodayFetch stores and emits updated epoch millis`() =
        runTest {
            repository.preferences.test {
                assertEquals(0L, awaitItem().lastTodayFetchEpochMillis)

                repository.updateLastTodayFetch(1_700_000_000_000L)

                assertEquals(1_700_000_000_000L, awaitItem().lastTodayFetchEpochMillis)
                cancelAndIgnoreRemainingEvents()
            }
        }

    @Test
    fun `privacy toggles persist`() =
        runTest {
            repository.preferences.test {
                awaitItem()

                repository.updateBiometricLockEnabled(true)
                awaitItem()
                repository.updateBiometricIdleTimeoutMinutes(30)
                awaitItem()
                repository.updatePushNotificationsEnabled(false)
                awaitItem()
                repository.updateCalendarSyncEnabled(true)
                awaitItem()
                repository.updateShowDeviceCalendars(true)
                awaitItem()
                repository.updateEnabledDeviceCalendarIds(setOf("1", "2"))

                val updated = awaitItem()
                assertEquals(true, updated.biometricLockEnabled)
                assertEquals(30, updated.biometricIdleTimeoutMinutes)
                assertEquals(false, updated.pushNotificationsEnabled)
                assertEquals(true, updated.calendarSyncEnabled)
                assertEquals(true, updated.showDeviceCalendars)
                assertEquals(setOf("1", "2"), updated.enabledDeviceCalendarIds)
                cancelAndIgnoreRemainingEvents()
            }
        }
}

private class FakePreferencesDataStore : DataStore<Preferences> {
    private val _data = MutableStateFlow(emptyPreferences())
    override val data: Flow<Preferences> = _data

    override suspend fun updateData(transform: suspend (t: Preferences) -> Preferences): Preferences {
        val newPrefs = transform(_data.value)
        _data.value = newPrefs
        return newPrefs
    }
}
