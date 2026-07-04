package com.daynest.android.widget

import android.appwidget.AppWidgetManager
import android.content.Context
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver

/**
 * AppWidget broadcast receiver for the small (2×1) Today widget.
 *
 * On update (widget added / system-initiated refresh), an immediate one-shot
 * [TodayWidgetRefreshWorker] is enqueued so the widget shows current cached data right away.
 */
class TodayWidgetSmallReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = TodayWidgetSmall()

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        super.onUpdate(context, appWidgetManager, appWidgetIds)
        TodayWidgetRefreshWorker.enqueueImmediateRefresh(context)
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
