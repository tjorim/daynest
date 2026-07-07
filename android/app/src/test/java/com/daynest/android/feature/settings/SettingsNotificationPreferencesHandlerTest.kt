package com.daynest.android.feature.settings

import com.daynest.android.data.settings.CalendarFeedDto
import com.daynest.android.data.settings.IntegrationClientCreateResponseDto
import com.daynest.android.data.settings.IntegrationClientDto
import com.daynest.android.data.settings.IntegrationClientInputDto
import com.daynest.android.data.settings.OAuthSessionDto
import com.daynest.android.data.settings.SettingsApi
import com.daynest.android.data.settings.SettingsRepository
import com.daynest.android.data.settings.UserSettingsDto
import com.daynest.android.data.settings.UserSettingsPatchDto
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class SettingsNotificationPreferencesHandlerTest {
    private val dispatcher = StandardTestDispatcher()

    @Test
    fun `timezone update applies optimistic state and persists patch`() = runTest(dispatcher) {
        val api = FakeSettingsApi()
        val uiState = MutableStateFlow<SettingsUiState>(settingsContent())
        val handler = SettingsNotificationPreferencesHandler(this, SettingsRepository(api), uiState)

        handler.onEvent(SettingsUiEvent.UpdateTimezone("Europe/Brussels"))
        advanceUntilIdle()

        val state = uiState.value as SettingsUiState.Content
        assertEquals("Europe/Brussels", state.timezone)
        assertFalse(state.userSettingsSaving)
        assertEquals("Europe/Brussels", api.lastPatch?.timezone)
    }

    @Test
    fun `failed update reverts optimistic state`() = runTest(dispatcher) {
        val api = FakeSettingsApi(updateError = IllegalStateException("save failed"))
        val uiState = MutableStateFlow<SettingsUiState>(settingsContent(pushOverdueChoresEnabled = false))
        val handler = SettingsNotificationPreferencesHandler(this, SettingsRepository(api), uiState)

        handler.onEvent(SettingsUiEvent.UpdatePushOverdueChoresEnabled(true))
        advanceUntilIdle()

        val state = uiState.value as SettingsUiState.Content
        assertFalse(state.pushOverdueChoresEnabled)
        assertFalse(state.userSettingsSaving)
        assertEquals(true, api.lastPatch?.pushOverdueChoresEnabled)
    }

    @Test
    fun `quiet hours update persists both boundaries`() = runTest(dispatcher) {
        val api = FakeSettingsApi()
        val uiState = MutableStateFlow<SettingsUiState>(settingsContent())
        val handler = SettingsNotificationPreferencesHandler(this, SettingsRepository(api), uiState)

        handler.onEvent(SettingsUiEvent.UpdateQuietHours(start = "22:00", end = "07:00"))
        advanceUntilIdle()

        val state = uiState.value as SettingsUiState.Content
        assertEquals("22:00", state.quietHoursStart)
        assertEquals("07:00", state.quietHoursEnd)
        assertEquals("22:00", api.lastPatch?.quietHoursStart)
        assertEquals("07:00", api.lastPatch?.quietHoursEnd)
    }

    @Test
    fun `calendar feed regeneration updates feed url`() = runTest(dispatcher) {
        val api =
            FakeSettingsApi(
                calendarFeed =
                CalendarFeedDto(
                    token = "new-token",
                    feedUrl = "https://example.test/new.ics"
                )
            )
        val uiState =
            MutableStateFlow<SettingsUiState>(
                settingsContent(calendarFeedUrl = "https://example.test/old.ics")
            )
        val handler = SettingsNotificationPreferencesHandler(this, SettingsRepository(api), uiState)

        handler.onEvent(SettingsUiEvent.RegenerateCalendarFeedClicked)
        advanceUntilIdle()

        val state = uiState.value as SettingsUiState.Content
        assertEquals("https://example.test/new.ics", state.calendarFeedUrl)
        assertFalse(state.calendarFeedRegenerating)
    }

    @Test
    fun `event is ignored outside content state`() = runTest(dispatcher) {
        val api = FakeSettingsApi()
        val uiState = MutableStateFlow<SettingsUiState>(SettingsUiState.Loading)
        val handler = SettingsNotificationPreferencesHandler(this, SettingsRepository(api), uiState)

        handler.onEvent(SettingsUiEvent.UpdateMedicationReminderMinutes(30))
        advanceUntilIdle()

        assertEquals(SettingsUiState.Loading, uiState.value)
        assertNull(api.lastPatch)
    }
}

private class FakeSettingsApi(
    private val updateError: Throwable? = null,
    private val calendarFeed: CalendarFeedDto =
        CalendarFeedDto(
            token = "token",
            feedUrl = "https://example.test/feed.ics"
        )
) : SettingsApi {
    var lastPatch: UserSettingsPatchDto? = null
        private set

    override suspend fun listClients(): List<IntegrationClientDto> = emptyList()

    override suspend fun createClient(request: IntegrationClientInputDto): IntegrationClientCreateResponseDto =
        error("Not used")

    override suspend fun listSessions(): List<OAuthSessionDto> = emptyList()

    override suspend fun revokeSession(id: String) = Unit

    override suspend fun getUserSettings(): UserSettingsDto = settingsDto()

    override suspend fun updateUserSettings(request: UserSettingsPatchDto): UserSettingsDto {
        lastPatch = request
        updateError?.let { throw it }
        val current = settingsDto()
        return current.copy(
            timezone = request.timezone ?: current.timezone,
            medicationReminderMinutes = request.medicationReminderMinutes ?: current.medicationReminderMinutes,
            quietHoursStart = request.quietHoursStart ?: current.quietHoursStart,
            quietHoursEnd = request.quietHoursEnd ?: current.quietHoursEnd,
            pushOverdueChoresEnabled =
            request.pushOverdueChoresEnabled ?: current.pushOverdueChoresEnabled,
            pushMedicationRemindersEnabled =
            request.pushMedicationRemindersEnabled ?: current.pushMedicationRemindersEnabled,
            pushMissedMedicationsEnabled =
            request.pushMissedMedicationsEnabled ?: current.pushMissedMedicationsEnabled
        )
    }

    override suspend fun getCalendarFeed(): CalendarFeedDto = calendarFeed

    override suspend fun regenerateCalendarFeed(): CalendarFeedDto = calendarFeed

    override suspend fun deleteCurrentUser() = Unit
}

private fun settingsContent(
    pushOverdueChoresEnabled: Boolean = false,
    calendarFeedUrl: String? = null
): SettingsUiState.Content = SettingsUiState.Content(
    clients = emptyList(),
    sessions = emptyList(),
    showCreateForm = false,
    newApiKey = null,
    showDeleteAccountConfirm = false,
    isDeletingAccount = false,
    accountDeletionError = null,
    clientsLoadError = false,
    sessionsLoadError = false,
    customServerUrl = null,
    defaultServerUrl = "https://example.test",
    pushNotificationsEnabled = false,
    biometricLockEnabled = false,
    biometricIdleTimeoutMinutes = 15,
    calendarSyncEnabled = false,
    showDeviceCalendars = false,
    deviceCalendars = emptyList(),
    enabledDeviceCalendarIds = emptySet(),
    timezone = "UTC",
    pushOverdueChoresEnabled = pushOverdueChoresEnabled,
    pushMedicationRemindersEnabled = false,
    pushMissedMedicationsEnabled = false,
    medicationReminderMinutes = 15,
    quietHoursStart = null,
    quietHoursEnd = null,
    userSettingsLoadError = false,
    userSettingsSaving = false,
    calendarFeedUrl = calendarFeedUrl,
    calendarFeedRegenerating = false
)

private fun settingsDto() = UserSettingsDto(
    timezone = "UTC",
    defaultSnoozeDays = 1,
    medicationReminderMinutes = 15,
    quietHoursStart = null,
    quietHoursEnd = null,
    pushOverdueChoresEnabled = false,
    pushMedicationRemindersEnabled = false,
    pushMissedMedicationsEnabled = false
)
