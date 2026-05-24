package com.daynest.android.core.notifications

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.daynest.android.data.sync.DaynestSyncScheduler
import com.daynest.android.data.today.TodayRepository
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import java.time.LocalDate

@HiltWorker
class NotificationActionWorker
    @AssistedInject
    constructor(
        @Assisted appContext: Context,
        @Assisted params: WorkerParameters,
        private val todayRepository: TodayRepository,
    ) : CoroutineWorker(appContext, params) {
        override suspend fun doWork(): Result {
            val id = inputData.getInt(KEY_ITEM_ID, -1).takeIf { it > 0 }
            val type = inputData.getString(KEY_TYPE).orEmpty()
            val action = inputData.getString(KEY_ACTION).orEmpty()
            val mutationSucceeded =
                if (id == null) {
                    true
                } else {
                    when {
                        type == "medication" && action == "complete" -> todayRepository.takeDose(id).isSuccess
                        type == "medication" && action == "skip" -> todayRepository.skipDose(id).isSuccess
                        action == "complete" -> todayRepository.completeChore(id).isSuccess
                        action == "skip" -> todayRepository.skipChore(id).isSuccess
                        action == "snooze" ->
                            todayRepository
                                .rescheduleChore(id, LocalDate.now().plusDays(1).toString())
                                .isSuccess
                        else -> true
                    }
                }
            return if (mutationSucceeded) {
                DaynestSyncScheduler.enqueueOneShot(applicationContext)
                Result.success()
            } else {
                Result.retry()
            }
        }

        companion object {
            const val KEY_TYPE = "type"
            const val KEY_ITEM_ID = "item_id"
            const val KEY_ACTION = "action"
        }
    }
