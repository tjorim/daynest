package com.daynest.android.core.storage.preferences

import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import app.cash.turbine.test
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

@OptIn(ExperimentalCoroutinesApi::class)
class UserPreferencesRepositoryTest {
    @get:Rule
    val tmpFolder = TemporaryFolder()

    private fun createRepository(): UserPreferencesRepository {
        val dataStore =
            PreferenceDataStoreFactory.create(
                produceFile = { tmpFolder.newFile("test_prefs.preferences_pb") },
            )
        return UserPreferencesRepository(dataStore)
    }

    @Test
    fun `preferences emits default value when no data stored`() =
        runTest {
            val repository = createRepository()

            repository.preferences.test {
                val prefs = awaitItem()
                assertEquals(0L, prefs.lastTodayFetchEpochMillis)
                cancelAndIgnoreRemainingEvents()
            }
        }

    @Test
    fun `updateLastTodayFetch stores and emits updated epoch millis`() =
        runTest {
            val repository = createRepository()

            repository.preferences.test {
                assertEquals(0L, awaitItem().lastTodayFetchEpochMillis)

                repository.updateLastTodayFetch(1_700_000_000_000L)

                assertEquals(1_700_000_000_000L, awaitItem().lastTodayFetchEpochMillis)
                cancelAndIgnoreRemainingEvents()
            }
        }
}
