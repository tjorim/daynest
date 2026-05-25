package com.daynest.android.widget

import android.appwidget.AppWidgetManager
import android.content.Context
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver

/**
 * AppWidget broadcast receiver for the medium (4×2) Today widget.
 *
 * On update (widget added / system-initiated refresh), an immediate one-shot
 * [TodayWidgetRefreshWorker] is enqueued so the widget shows current cached data right away.
 */
class TodayWidgetMediumReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = TodayWidgetMedium()

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        super.onUpdate(context, appWidgetManager, appWidgetIds)
        TodayWidgetSmallReceiver.enqueueImmediateRefresh(context)
    }

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        TodayWidgetRefreshWorker.schedulePeriodic(context)
    }

    override fun onDisabled(context: Context) {
        super.onDisabled(context)
        TodayWidgetRefreshWorker.cancelPeriodicIfNoWidgets(context)
    }
}
