package com.daynest.android.widget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import androidx.datastore.preferences.core.MutablePreferences
import androidx.glance.GlanceId
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
            val manager = GlanceAppWidgetManager(appContext)
            val today = loadToday()
            if (today == null) {
                clearWidgetsToNoData(manager)
                return Result.success()
            }
            val widgetState = today.toWidgetState()
            updateSmallWidgets(manager, widgetState)
            updateMediumWidgets(manager, widgetState)

            return Result.success()
        }

        private suspend fun loadToday(): TodayResponseDto? {
            val cacheEntry = cacheEntryDao.get(SyncCacheKeys.TODAY)
            return cacheEntry?.payload?.let { payload ->
                runCatching {
                    JsonSerializer.config.decodeFromString(TodayResponseDto.serializer(), payload)
                }.getOrNull()
            }
        }

        private fun TodayResponseDto.toWidgetState(): TodayWidgetState {
            val totalItems =
                routines.size +
                    dueToday.size +
                    overdue.size +
                    medication.size +
                    medicationHistory.size +
                    planned.size
            val pendingItems =
                routines.count { it.status == "pending" } +
                    dueToday.count { it.status == "pending" } +
                    overdue.size +
                    medication.count { it.status == "scheduled" } +
                    planned.count { !it.isDone }
            val doneItems = (totalItems - pendingItems).coerceAtLeast(0)
            val completionPercent =
                if (totalItems > 0) ((doneItems * 100) / totalItems).coerceIn(0, 100) else 100
            val topDueItems =
                dueToday
                    .filter { it.status == "pending" }
                    .map { it.title }
                    .plus(overdue.map { it.title })
                    .take(MAX_DUE_ITEMS)

            return TodayWidgetState(
                completionPercent = completionPercent,
                doneItems = doneItems,
                totalItems = totalItems,
                overdueCount = overdue.size,
                nextMedicationName = medication.firstOrNull { it.status == "scheduled" }?.name,
                topDueItems = topDueItems,
            )
        }

        private suspend fun updateSmallWidgets(
            manager: GlanceAppWidgetManager,
            widgetState: TodayWidgetState,
        ) {
            for (id in manager.getGlanceIds(TodayWidgetSmall::class.java)) {
                updateAppWidgetState(appContext, PreferencesGlanceStateDefinition, id) { prefs ->
                    prefs.toMutablePreferences().applyWidgetBase(widgetState).toPreferences()
                }
                TodayWidgetSmall().update(appContext, id)
            }
        }

        private suspend fun updateMediumWidgets(
            manager: GlanceAppWidgetManager,
            widgetState: TodayWidgetState,
        ) {
            for (id in manager.getGlanceIds(TodayWidgetMedium::class.java)) {
                updateMediumWidget(id, widgetState)
            }
        }

        private suspend fun clearWidgetsToNoData(manager: GlanceAppWidgetManager) {
            for (id in manager.getGlanceIds(TodayWidgetSmall::class.java)) {
                updateAppWidgetState(appContext, PreferencesGlanceStateDefinition, id) { prefs ->
                    prefs.toMutablePreferences().applyNoDataState().toPreferences()
                }
                TodayWidgetSmall().update(appContext, id)
            }
            for (id in manager.getGlanceIds(TodayWidgetMedium::class.java)) {
                updateAppWidgetState(appContext, PreferencesGlanceStateDefinition, id) { prefs ->
                    prefs.toMutablePreferences().applyNoDataState().toPreferences()
                }
                TodayWidgetMedium().update(appContext, id)
            }
        }

        private suspend fun updateMediumWidget(
            id: GlanceId,
            widgetState: TodayWidgetState,
        ) {
            updateAppWidgetState(appContext, PreferencesGlanceStateDefinition, id) { prefs ->
                prefs
                    .toMutablePreferences()
                    .applyWidgetBase(widgetState)
                    .applyMediumWidgetState(widgetState)
                    .toPreferences()
            }
            TodayWidgetMedium().update(appContext, id)
        }

        private fun MutablePreferences.applyWidgetBase(widgetState: TodayWidgetState): MutablePreferences =
            apply {
                this[TodayWidgetStateKeys.COMPLETION_PERCENT] = widgetState.completionPercent
                this[TodayWidgetStateKeys.DONE_COUNT] = widgetState.doneItems
                this[TodayWidgetStateKeys.TOTAL_COUNT] = widgetState.totalItems
                this[TodayWidgetStateKeys.OVERDUE_COUNT] = widgetState.overdueCount
                this[TodayWidgetStateKeys.DATA_LOADED] = true
            }

        private fun MutablePreferences.applyMediumWidgetState(widgetState: TodayWidgetState): MutablePreferences =
            apply {
                putOrRemove(TodayWidgetStateKeys.NEXT_MEDICATION_NAME, widgetState.nextMedicationName)
                putOrRemove(TodayWidgetStateKeys.DUE_ITEM_0, widgetState.topDueItems.getOrNull(0))
                putOrRemove(TodayWidgetStateKeys.DUE_ITEM_1, widgetState.topDueItems.getOrNull(1))
                putOrRemove(TodayWidgetStateKeys.DUE_ITEM_2, widgetState.topDueItems.getOrNull(2))
            }

        private fun MutablePreferences.applyNoDataState(): MutablePreferences =
            apply {
                this[TodayWidgetStateKeys.DATA_LOADED] = false
                this[TodayWidgetStateKeys.COMPLETION_PERCENT] = 0
                this[TodayWidgetStateKeys.DONE_COUNT] = 0
                this[TodayWidgetStateKeys.TOTAL_COUNT] = 0
                this[TodayWidgetStateKeys.OVERDUE_COUNT] = 0
                remove(TodayWidgetStateKeys.NEXT_MEDICATION_NAME)
                remove(TodayWidgetStateKeys.DUE_ITEM_0)
                remove(TodayWidgetStateKeys.DUE_ITEM_1)
                remove(TodayWidgetStateKeys.DUE_ITEM_2)
            }

        private fun MutablePreferences.putOrRemove(
            key: androidx.datastore.preferences.core.Preferences.Key<String>,
            value: String?,
        ) {
            if (value != null) {
                this[key] = value
            } else {
                remove(key)
            }
        }

        companion object {
            internal const val IMMEDIATE_WORK_NAME = "daynest_widget_refresh_immediate"
            private const val PERIODIC_WORK_NAME = "daynest_widget_refresh_periodic"
            private const val MAX_DUE_ITEMS = 3
            private const val PERIODIC_REFRESH_MINUTES = 15L

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
                val refreshRequest =
                    PeriodicWorkRequestBuilder<TodayWidgetRefreshWorker>(
                        PERIODIC_REFRESH_MINUTES,
                        TimeUnit.MINUTES,
                    ).setConstraints(
                        Constraints
                            .Builder()
                            .setRequiredNetworkType(NetworkType.NOT_REQUIRED)
                            .build(),
                    ).build()

                WorkManager
                    .getInstance(context)
                    .enqueueUniquePeriodicWork(
                        PERIODIC_WORK_NAME,
                        ExistingPeriodicWorkPolicy.UPDATE,
                        refreshRequest,
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

private data class TodayWidgetState(
    val completionPercent: Int,
    val doneItems: Int,
    val totalItems: Int,
    val overdueCount: Int,
    val nextMedicationName: String?,
    val topDueItems: List<String>,
)
