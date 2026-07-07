package com.daynest.android.data

import com.daynest.android.core.network.JsonSerializer
import com.daynest.android.data.analytics.AnalyticsApi
import com.daynest.android.data.search.SearchApi
import com.daynest.android.data.settings.SettingsApi
import com.daynest.android.data.settings.UserSettingsPatchDto
import kotlinx.coroutines.test.runTest
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory

class AndroidGrowthApiTest {
    private lateinit var server: MockWebServer

    @Before
    fun setUp() {
        server = MockWebServer()
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    @Test
    fun `search sends query and default limit`() = runTest {
        server.enqueue(
            MockResponse()
                .setHeader("Content-Type", "application/json")
                .setBody(
                    """
                    {"query":"milk","routine_templates":[],"chore_templates":[],"medication_plans":[],"planned_items":[]}
                    """.trimIndent()
                )
        )
        val api = createApi<SearchApi>()

        val response = api.search("milk")

        val request = server.takeRequest()
        assertEquals("/api/search?q=milk&limit=20", request.path)
        assertEquals("milk", response.query)
    }

    @Test
    fun `analytics summary sends selected period`() = runTest {
        server.enqueue(
            MockResponse()
                .setHeader("Content-Type", "application/json")
                .setBody(
                    """
                    {
                      "period":"month",
                      "start_date":"2026-07-01",
                      "end_date":"2026-07-31",
                      "chores":{"completion_rate":0.5,"total_completed":1,"total_scheduled":2,"daily_completions":[],"streaks":[],"most_skipped":[]},
                      "medications":{"adherence_rate":1.0,"total_taken":3,"total_scheduled":3,"daily_adherence":[]},
                      "planned_items":{"completion_rate":0.0,"total_completed":0,"total_scheduled":1,"daily_completions":[]},
                      "routines":{"completion_rate":1.0,"total_completed":4,"total_scheduled":4,"daily_completions":[],"streaks":[]}
                    }
                    """.trimIndent()
                )
        )
        val api = createApi<AnalyticsApi>()

        val response = api.getSummary("month")

        val request = server.takeRequest()
        assertEquals("/api/analytics/summary?period=month", request.path)
        assertEquals("month", response.period)
    }

    @Test
    fun `calendar feed regeneration uses post endpoint`() = runTest {
        server.enqueue(
            MockResponse()
                .setHeader("Content-Type", "application/json")
                .setBody("""{"token":"feed-token","feed_url":"https://example.test/calendar.ics"}""")
        )
        val api = createApi<SettingsApi>()

        val response = api.regenerateCalendarFeed()

        val request = server.takeRequest()
        assertEquals("POST", request.method)
        assertEquals("/api/calendar/feed/regenerate", request.path)
        assertEquals("https://example.test/calendar.ics", response.feedUrl)
    }

    @Test
    fun `user settings patch serializes notification preferences`() = runTest {
        server.enqueue(
            MockResponse()
                .setHeader("Content-Type", "application/json")
                .setBody(
                    """
                    {
                      "timezone":"Europe/Brussels",
                      "default_snooze_days":1,
                      "medication_reminder_minutes":45,
                      "quiet_hours_start":"22:00",
                      "quiet_hours_end":"07:00",
                      "push_overdue_chores_enabled":true,
                      "push_medication_reminders_enabled":true,
                      "push_missed_medications_enabled":false
                    }
                    """.trimIndent()
                )
        )
        val api = createApi<SettingsApi>()

        api.updateUserSettings(
            UserSettingsPatchDto(
                timezone = "Europe/Brussels",
                medicationReminderMinutes = 45,
                quietHoursStart = "22:00",
                quietHoursEnd = "07:00",
                pushOverdueChoresEnabled = true
            )
        )

        val request = server.takeRequest()
        assertEquals("PATCH", request.method)
        assertEquals("/api/users/me/settings", request.path)
        assertEquals(
            true,
            request.body.readUtf8().contains(""""push_overdue_chores_enabled":true""")
        )
    }

    private inline fun <reified T> createApi(): T = Retrofit.Builder()
        .baseUrl(server.url("/"))
        .addConverterFactory(JsonSerializer.config.asConverterFactory("application/json".toMediaType()))
        .build()
        .create(T::class.java)
}
