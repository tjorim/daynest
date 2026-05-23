package com.daynest.android.core.notifications

import android.Manifest
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
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
            if (!notificationManager.areNotificationsEnabled()) return
            if (
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) !=
                PackageManager.PERMISSION_GRANTED
            ) {
                return
            }
            val channelId =
                when (type) {
                    "medication" -> DaynestNotificationChannels.MEDICATION_CHANNEL_ID
                    else -> DaynestNotificationChannels.CHORE_CHANNEL_ID
                }
            val openIntent =
                Intent(context, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                    putExtra("daynest_notification_type", type)
                    putExtra("daynest_notification_item_id", itemId)
                }
            val openPendingIntent =
                PendingIntent.getActivity(
                    context,
                    itemId ?: 0,
                    openIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
                )
            val completeIntent =
                PendingIntent.getActivity(
                    context,
                    (itemId ?: 0) + 1000,
                    Intent(openIntent).putExtra("daynest_quick_action", "complete"),
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
                )
            val skipIntent =
                PendingIntent.getActivity(
                    context,
                    (itemId ?: 0) + 2000,
                    Intent(openIntent).putExtra("daynest_quick_action", "skip"),
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
                )
            val notification =
                NotificationCompat.Builder(context, channelId)
                    .setSmallIcon(android.R.drawable.ic_dialog_info)
                    .setContentTitle(title)
                    .setContentText(body)
                    .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                    .setAutoCancel(true)
                    .setContentIntent(openPendingIntent)
                    .addAction(0, context.getString(R.string.action_done), completeIntent)
                    .addAction(0, context.getString(R.string.action_skip), skipIntent)
                    .build()
            notificationManager.notify(itemId ?: type.hashCode(), notification)
        }
    }
