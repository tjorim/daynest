@file:Suppress("ktlint:standard:function-naming", "FunctionNaming")

package com.daynest.android.widget

import android.content.Context
import android.content.Intent
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.datastore.preferences.core.Preferences
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.LocalContext
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.currentState
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.state.PreferencesGlanceStateDefinition
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import com.daynest.android.MainActivity
import com.daynest.android.R

/**
 * Small (2×1) home-screen widget that shows the day's completion percentage and overdue count.
 *
 * Tap anywhere to open the app at the Today screen.
 */
class TodayWidgetSmall : GlanceAppWidget() {
    override val stateDefinition = PreferencesGlanceStateDefinition

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        provideContent { SmallWidgetContent() }
    }
}

@Composable
private fun SmallWidgetContent() {
    val prefs = currentState<Preferences>()
    val context = LocalContext.current

    val completionPercent = prefs[TodayWidgetStateKeys.COMPLETION_PERCENT] ?: 0
    val overdueCount = prefs[TodayWidgetStateKeys.OVERDUE_COUNT] ?: 0
    val dataLoaded = prefs[TodayWidgetStateKeys.DATA_LOADED] ?: false

    val launchIntent =
        Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }

    GlanceTheme {
        SmallWidgetContainer(launchIntent = launchIntent) {
            if (dataLoaded) {
                SmallWidgetLoadedContent(
                    completionPercent = completionPercent,
                    overdueCount = overdueCount,
                    context = context
                )
            } else {
                SmallWidgetNoData(context = context)
            }
        }
    }
}

@Composable
private fun SmallWidgetContainer(launchIntent: Intent, content: @Composable () -> Unit) {
    Box(
        modifier =
        GlanceModifier
            .fillMaxSize()
            .background(GlanceTheme.colors.surface)
            .clickable(actionStartActivity(launchIntent))
            .padding(12.dp),
        contentAlignment = Alignment.CenterStart
    ) {
        content()
    }
}

@Composable
private fun SmallWidgetNoData(context: Context) {
    Text(
        text = context.getString(R.string.widget_no_data),
        style =
        TextStyle(
            color = GlanceTheme.colors.onSurface,
            fontSize = 12.sp
        )
    )
}

@Composable
private fun SmallWidgetLoadedContent(completionPercent: Int, overdueCount: Int, context: Context) {
    Column {
        Text(
            text = context.getString(R.string.widget_completion_percent, completionPercent),
            style =
            TextStyle(
                color = GlanceTheme.colors.primary,
                fontSize = 26.sp,
                fontWeight = FontWeight.Bold
            )
        )
        if (overdueCount > 0) {
            Spacer(modifier = GlanceModifier.height(2.dp))
            SmallWidgetOverdueCount(overdueCount = overdueCount, context = context)
        }
    }
}

@Composable
private fun SmallWidgetOverdueCount(overdueCount: Int, context: Context) {
    Text(
        text =
        context.resources.getQuantityString(
            R.plurals.widget_overdue_count,
            overdueCount,
            overdueCount
        ),
        style =
        TextStyle(
            color = GlanceTheme.colors.error,
            fontSize = 11.sp
        )
    )
}
