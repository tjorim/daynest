package com.daynest.android.core.notifications

import android.Manifest
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.daynest.android.MainActivity
import com.daynest.android.R
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PushNotificationHandler
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
    ) {
        fun handlePayload(
            type: String,
            title: String,
            body: String,
            itemId: Int?,
        ) {
            val notificationManager = NotificationManagerCompat.from(context)
            if (!canPostNotifications(notificationManager)) return

            val channelId =
                when (type) {
                    "medication" -> DaynestNotificationChannels.MEDICATION_CHANNEL_ID
                    else -> DaynestNotificationChannels.CHORE_CHANNEL_ID
                }
            val openPendingIntent = createOpenIntent(type, itemId)
            val completeIntent = createActionIntent(type, itemId, "complete", 1000)
            val skipIntent = createActionIntent(type, itemId, "skip", 2000)
            val notification =
                NotificationCompat
                    .Builder(context, channelId)
                    .setSmallIcon(android.R.drawable.ic_dialog_info)
                    .setContentTitle(title)
                    .setContentText(body)
                    .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                    .setAutoCancel(true)
                    .setContentIntent(openPendingIntent)
                    .addAction(0, context.getString(R.string.action_done), completeIntent)
                    .addAction(0, context.getString(R.string.action_skip), skipIntent)
                    .build()
            try {
                notificationManager.notify(itemId ?: type.hashCode(), notification)
            } catch (error: SecurityException) {
                Log.w("PushNotificationHandler", "Notification permission denied while posting", error)
            }
        }

        private fun canPostNotifications(notificationManager: NotificationManagerCompat): Boolean {
            if (!notificationManager.areNotificationsEnabled()) return false
            return Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
                ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) ==
                PackageManager.PERMISSION_GRANTED
        }

        private fun createOpenIntent(
            type: String,
            itemId: Int?,
        ): PendingIntent {
            val openIntent =
                Intent(context, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                    putExtra("daynest_notification_type", type)
                    putExtra("daynest_notification_item_id", itemId)
                }
            return PendingIntent.getActivity(
                context,
                itemId ?: 0,
                openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        }

        private fun createActionIntent(
            type: String,
            itemId: Int?,
            action: String,
            requestCodeOffset: Int,
        ): PendingIntent {
            val completeActionIntent =
                Intent(context, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                    setClass(context, MainActivity::class.java)
                    `package` = context.packageName
                    putExtra("daynest_notification_type", type)
                    putExtra("daynest_notification_item_id", itemId)
                    putExtra("daynest_quick_action", action)
                }
            return PendingIntent.getActivity(
                context,
                (itemId ?: 0) + requestCodeOffset,
                completeActionIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        }
    }
