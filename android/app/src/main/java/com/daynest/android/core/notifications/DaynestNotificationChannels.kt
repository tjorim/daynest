package com.daynest.android.core.notifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import com.daynest.android.R

object DaynestNotificationChannels {
    const val CHORE_CHANNEL_ID = "daynest_chore_reminders"
    const val MEDICATION_CHANNEL_ID = "daynest_medication_reminders"

    fun ensureCreated(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        val channels =
            listOf(
                NotificationChannel(
                    CHORE_CHANNEL_ID,
                    context.getString(R.string.notification_channel_chore_reminders),
                    NotificationManager.IMPORTANCE_DEFAULT,
                ),
                NotificationChannel(
                    MEDICATION_CHANNEL_ID,
                    context.getString(R.string.notification_channel_medication_reminders),
                    NotificationManager.IMPORTANCE_HIGH,
                ),
            )
        manager.createNotificationChannels(channels)
    }
}
