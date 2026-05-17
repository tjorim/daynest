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
                assertEquals(null, prefs.customServerUrl)
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

    @Test
    fun `updateCustomServerUrl stores and emits the new URL`() =
        runTest {
            val repository = createRepository()

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
            val repository = createRepository()

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
