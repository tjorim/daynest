package com.daynest.android.core.notifications

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.workDataOf

class NotificationActionReceiver : BroadcastReceiver() {
    override fun onReceive(
        context: Context,
        intent: Intent,
    ) {
        val request =
            OneTimeWorkRequestBuilder<NotificationActionWorker>()
                .setInputData(
                    workDataOf(
                        NotificationActionWorker.KEY_TYPE to intent.getStringExtra("daynest_notification_type"),
                        NotificationActionWorker.KEY_ITEM_ID to intent.getIntExtra("daynest_notification_item_id", -1),
                        NotificationActionWorker.KEY_ACTION to intent.getStringExtra("daynest_quick_action"),
                    ),
                ).build()
        WorkManager.getInstance(context).enqueue(request)
    }
}
