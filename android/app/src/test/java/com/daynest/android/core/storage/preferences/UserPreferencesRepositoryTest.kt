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
                assertEquals(null, prefs.customServerUrl)
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
    fun `updateCustomServerUrl stores and emits the new URL`() =
        runTest {
            repository.preferences.test {
                assertEquals(null, awaitItem().customServerUrl)

                repository.updateCustomServerUrl("https://selfhosted.example.com/")

                assertEquals("https://selfhosted.example.com/", awaitItem().customServerUrl)
                cancelAndIgnoreRemainingEvents()
            }
        }

    @Test
    fun `updateCustomServerUrl with null clears the stored URL`() =
        runTest {
            repository.preferences.test {
                awaitItem() // initial default

                repository.updateCustomServerUrl("https://selfhosted.example.com/")
                awaitItem() // after set

                repository.updateCustomServerUrl(null)

                assertEquals(null, awaitItem().customServerUrl)
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
