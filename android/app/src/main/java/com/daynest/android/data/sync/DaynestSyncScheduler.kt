package com.daynest.android.data.sync

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

object DaynestSyncScheduler {
    private const val PERIODIC_SYNC_NAME = "daynest_periodic_sync"
    private const val ONE_SHOT_SYNC_NAME = "daynest_one_shot_sync"

    fun schedulePeriodic(context: Context) {
        val constraints =
            Constraints
                .Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()
        val request =
            PeriodicWorkRequestBuilder<DaynestSyncWorker>(15, TimeUnit.MINUTES)
                .setConstraints(constraints)
                .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            PERIODIC_SYNC_NAME,
            ExistingPeriodicWorkPolicy.UPDATE,
            request,
        )
    }

    fun enqueueOneShot(context: Context) {
        val constraints =
            Constraints
                .Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()
        val request =
            OneTimeWorkRequestBuilder<DaynestSyncWorker>()
                .setConstraints(constraints)
                .build()
        WorkManager.getInstance(context).enqueueUniqueWork(
            ONE_SHOT_SYNC_NAME,
            ExistingWorkPolicy.REPLACE,
            request,
        )
    }
}
