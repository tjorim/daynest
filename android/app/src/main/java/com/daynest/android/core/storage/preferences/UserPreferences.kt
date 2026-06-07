package com.daynest.android.core.storage.preferences

data class UserPreferences(
    val lastTodayFetchEpochMillis: Long = 0L,
    val customServerUrl: String? = null,
    val biometricLockEnabled: Boolean = false,
    val biometricIdleTimeoutMinutes: Int = 5,
    val pushNotificationsEnabled: Boolean = true,
    val calendarSyncEnabled: Boolean = false,
    val showDeviceCalendars: Boolean = false,
    val enabledDeviceCalendarIds: Set<String> = emptySet(),
    val lastBackgroundEpochMillis: Long = 0L,
    val lastFcmEndpoint: String? = null,
    val lastUnifiedPushEndpoint: String? = null,
)
