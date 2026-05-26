package com.daynest.android.widget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import androidx.datastore.preferences.core.MutablePreferences
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.state.updateAppWidgetState
import androidx.glance.state.PreferencesGlanceStateDefinition
import androidx.hilt.work.HiltWorker
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.daynest.android.core.database.sync.CacheEntryDao
import com.daynest.android.core.network.JsonSerializer
import com.daynest.android.data.sync.SyncCacheKeys
import com.daynest.android.data.today.TodayResponseDto
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import java.util.concurrent.TimeUnit

/**
 * WorkManager worker that reads the cached [TodayResponseDto], computes widget state, and
 * pushes updates to both the small and medium Glance app-widgets.
 *
 * It is scheduled as a periodic 15-minute job and can also be enqueued as a one-shot (e.g.
 * immediately after a widget is added to the home screen).
 *
 * The worker requires no network access – it operates purely from Room's offline cache.
 * The data sync that populates that cache is handled by [com.daynest.android.data.sync.DaynestSyncWorker].
 */
@HiltWorker
class TodayWidgetRefreshWorker
    @AssistedInject
    constructor(
        @Assisted private val appContext: Context,
        @Assisted params: WorkerParameters,
        private val cacheEntryDao: CacheEntryDao,
    ) : CoroutineWorker(appContext, params) {
        override suspend fun doWork(): Result {
            val cacheEntry = cacheEntryDao.get(SyncCacheKeys.TODAY)
            val today =
                cacheEntry?.payload?.let { payload ->
                    runCatching {
                        JsonSerializer.config.decodeFromString(TodayResponseDto.serializer(), payload)
                    }.getOrNull()
                }

            // Nothing in cache yet – leave widgets as-is and succeed quietly.
            if (today == null) return Result.success()

            val overdueCount = today.overdue.size
            val nextMedicationName = today.medication.firstOrNull { it.status == "scheduled" }?.name

            // Top due items: pending due-today first, then overdue titles
            val topDueItems =
                today.dueToday
                    .filter { it.status == "pending" }
                    .map { it.title }
                    .plus(today.overdue.map { it.title })
                    .take(MAX_DUE_ITEMS)

            // Completion %
            val totalItems =
                today.routines.size +
                    today.dueToday.size +
                    today.overdue.size +
                    today.medication.size +
                    today.medicationHistory.size +
                    today.planned.size
            val pendingItems =
                    today.routines.count { it.status == "pending" } +
                    today.dueToday.count { it.status == "pending" } +
                    today.overdue.size + // overdue items are always pending
                    today.medication.count { it.status == "scheduled" } + // scheduled doses are pending
                    today.planned.count { !it.isDone }
            val doneItems = (totalItems - pendingItems).coerceAtLeast(0)
            val completionPercent =
                if (totalItems > 0) ((doneItems * 100) / totalItems).coerceIn(0, 100) else 100

            val manager = GlanceAppWidgetManager(appContext)

            // ── Small widgets ──────────────────────────────────────────────────
            for (id in manager.getGlanceIds(TodayWidgetSmall::class.java)) {
                updateAppWidgetState(appContext, PreferencesGlanceStateDefinition, id) { prefs ->
                    prefs.toMutablePreferences().applyWidgetBase(
                        completionPercent = completionPercent,
                        doneItems = doneItems,
                        totalItems = totalItems,
                        overdueCount = overdueCount,
                    ).toPreferences()
                }
                TodayWidgetSmall().update(appContext, id)
            }

            // ── Medium widgets ─────────────────────────────────────────────────
            for (id in manager.getGlanceIds(TodayWidgetMedium::class.java)) {
                updateAppWidgetState(appContext, PreferencesGlanceStateDefinition, id) { prefs ->
                    prefs.toMutablePreferences().applyWidgetBase(
                        completionPercent = completionPercent,
                        doneItems = doneItems,
                        totalItems = totalItems,
                        overdueCount = overdueCount,
                    ).apply {
                        if (nextMedicationName != null) {
                            this[TodayWidgetStateKeys.NEXT_MEDICATION_NAME] = nextMedicationName
                        } else {
                            remove(TodayWidgetStateKeys.NEXT_MEDICATION_NAME)
                        }
                        topDueItems.getOrNull(0)
                            ?.let { this[TodayWidgetStateKeys.DUE_ITEM_0] = it }
                            ?: remove(TodayWidgetStateKeys.DUE_ITEM_0)
                        topDueItems.getOrNull(1)
                            ?.let { this[TodayWidgetStateKeys.DUE_ITEM_1] = it }
                            ?: remove(TodayWidgetStateKeys.DUE_ITEM_1)
                        topDueItems.getOrNull(2)
                            ?.let { this[TodayWidgetStateKeys.DUE_ITEM_2] = it }
                            ?: remove(TodayWidgetStateKeys.DUE_ITEM_2)
                    }.toPreferences()
                }
                TodayWidgetMedium().update(appContext, id)
            }

            return Result.success()
        }

        private fun MutablePreferences.applyWidgetBase(
            completionPercent: Int,
            doneItems: Int,
            totalItems: Int,
            overdueCount: Int,
        ): MutablePreferences =
            apply {
                this[TodayWidgetStateKeys.COMPLETION_PERCENT] = completionPercent
                this[TodayWidgetStateKeys.DONE_COUNT] = doneItems
                this[TodayWidgetStateKeys.TOTAL_COUNT] = totalItems
                this[TodayWidgetStateKeys.OVERDUE_COUNT] = overdueCount
                this[TodayWidgetStateKeys.DATA_LOADED] = true
            }

        companion object {
            internal const val IMMEDIATE_WORK_NAME = "daynest_widget_refresh_immediate"
            private const val PERIODIC_WORK_NAME = "daynest_widget_refresh_periodic"
            private const val MAX_DUE_ITEMS = 3

            /** Enqueue an immediate one-shot widget refresh. */
            fun enqueueImmediateRefresh(context: Context) {
                WorkManager
                    .getInstance(context)
                    .enqueueUniqueWork(
                        IMMEDIATE_WORK_NAME,
                        ExistingWorkPolicy.REPLACE,
                        OneTimeWorkRequestBuilder<TodayWidgetRefreshWorker>().build(),
                    )
            }

            /** Schedule the 15-minute periodic widget refresh via WorkManager. */
            fun schedulePeriodic(context: Context) {
                WorkManager
                    .getInstance(context)
                    .enqueueUniquePeriodicWork(
                        PERIODIC_WORK_NAME,
                        ExistingPeriodicWorkPolicy.UPDATE,
                        PeriodicWorkRequestBuilder<TodayWidgetRefreshWorker>(15L, TimeUnit.MINUTES)
                            .setConstraints(
                                Constraints
                                    .Builder()
                                    .setRequiredNetworkType(NetworkType.NOT_REQUIRED)
                                    .build(),
                            ).build(),
                    )
            }

            /**
             * Cancel the periodic widget refresh if no instances of either widget type are
             * currently installed on the home screen.
             */
            fun cancelPeriodicIfNoWidgets(context: Context) {
                val awm = AppWidgetManager.getInstance(context)
                val smallIds =
                    awm.getAppWidgetIds(ComponentName(context, TodayWidgetSmallReceiver::class.java))
                val mediumIds =
                    awm.getAppWidgetIds(ComponentName(context, TodayWidgetMediumReceiver::class.java))
                if (smallIds.isEmpty() && mediumIds.isEmpty()) {
                    WorkManager.getInstance(context).cancelUniqueWork(PERIODIC_WORK_NAME)
                }
            }
        }
    }
