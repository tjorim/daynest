@file:Suppress("ktlint:standard:function-naming", "FunctionNaming")

package com.daynest.android.widget

import android.content.Context
import android.content.Intent
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
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
import androidx.glance.color.ColorProvider
import androidx.glance.currentState
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxHeight
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.state.PreferencesGlanceStateDefinition
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import com.daynest.android.MainActivity
import com.daynest.android.R

/**
 * Medium (4×2) home-screen widget that shows:
 * - Completion progress bar
 * - Overdue count badge (configurable)
 * - Next scheduled medication chip (configurable)
 * - Up to 3 top due items (configurable)
 *
 * Tap anywhere to open the app at the Today screen.
 */
class TodayWidgetMedium : GlanceAppWidget() {
    override val stateDefinition = PreferencesGlanceStateDefinition

    override suspend fun provideGlance(
        context: Context,
        id: GlanceId,
    ) {
        provideContent { MediumWidgetContent() }
    }
}

@Composable
private fun MediumWidgetContent() {
    val prefs = currentState<Preferences>()
    val context = LocalContext.current
    val widgetState = prefs.toMediumWidgetState()
    val launchIntent =
        Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }

    GlanceTheme {
        MediumWidgetContainer(launchIntent = launchIntent) {
            if (widgetState.dataLoaded) {
                MediumWidgetLoadedContent(widgetState = widgetState, context = context)
            } else {
                MediumWidgetNoData(context = context)
            }
        }
    }
}

private fun Preferences.toMediumWidgetState(): MediumWidgetState =
    MediumWidgetState(
        completionPercent = this[TodayWidgetStateKeys.COMPLETION_PERCENT] ?: 0,
        overdueCount = this[TodayWidgetStateKeys.OVERDUE_COUNT] ?: 0,
        nextMedication = this[TodayWidgetStateKeys.NEXT_MEDICATION_NAME],
        dueItems =
            listOfNotNull(
                this[TodayWidgetStateKeys.DUE_ITEM_0],
                this[TodayWidgetStateKeys.DUE_ITEM_1],
                this[TodayWidgetStateKeys.DUE_ITEM_2],
            ),
        dataLoaded = this[TodayWidgetStateKeys.DATA_LOADED] ?: false,
        showMedication = this[TodayWidgetStateKeys.SHOW_MEDICATION] ?: true,
        showDueItems = this[TodayWidgetStateKeys.SHOW_DUE_ITEMS] ?: true,
        showOverdue = this[TodayWidgetStateKeys.SHOW_OVERDUE] ?: true,
    )

@Composable
private fun MediumWidgetContainer(
    launchIntent: Intent,
    content: @Composable () -> Unit,
) {
    Box(
        modifier =
            GlanceModifier
                .fillMaxSize()
                .background(GlanceTheme.colors.surface)
                .clickable(actionStartActivity(launchIntent))
                .padding(12.dp),
    ) {
        content()
    }
}

@Composable
private fun MediumWidgetNoData(context: Context) {
    Box(
        modifier = GlanceModifier.fillMaxSize(),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = context.getString(R.string.widget_no_data),
            style =
                TextStyle(
                    color = GlanceTheme.colors.onSurface,
                    fontSize = 12.sp,
                ),
        )
    }
}

@Composable
private fun MediumWidgetLoadedContent(
    widgetState: MediumWidgetState,
    context: Context,
) {
    Column(modifier = GlanceModifier.fillMaxSize()) {
        MediumWidgetTitleRow(widgetState = widgetState, context = context)
        Spacer(modifier = GlanceModifier.height(6.dp))
        WidgetProgressBar(percent = widgetState.completionPercent)
        Spacer(modifier = GlanceModifier.height(6.dp))
        MediumWidgetStatusRow(widgetState = widgetState, context = context)
        MediumWidgetDueItems(widgetState = widgetState, context = context)
    }
}

@Composable
private fun MediumWidgetTitleRow(
    widgetState: MediumWidgetState,
    context: Context,
) {
    Row(
        modifier = GlanceModifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = context.getString(R.string.widget_title),
            modifier = GlanceModifier.defaultWeight(),
            style =
                TextStyle(
                    color = GlanceTheme.colors.onSurface,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                ),
        )
        Text(
            text = context.getString(R.string.widget_completion_done, widgetState.completionPercent),
            style =
                TextStyle(
                    color = GlanceTheme.colors.primary,
                    fontSize = 12.sp,
                ),
        )
    }
}

@Composable
private fun MediumWidgetStatusRow(
    widgetState: MediumWidgetState,
    context: Context,
) {
    if (!widgetState.hasStatusRow) return
    Row(
        modifier = GlanceModifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        MediumWidgetOverdueBadge(widgetState = widgetState, context = context)
        if (widgetState.hasOverdue && widgetState.hasMedication) {
            Spacer(modifier = GlanceModifier.defaultWeight())
        }
        MediumWidgetMedicationChip(widgetState = widgetState, context = context)
    }
    Spacer(modifier = GlanceModifier.height(4.dp))
}

@Composable
private fun MediumWidgetOverdueBadge(
    widgetState: MediumWidgetState,
    context: Context,
) {
    if (!widgetState.hasOverdue) return
    Text(
        text =
            context.resources.getQuantityString(
                R.plurals.widget_overdue_count,
                widgetState.overdueCount,
                widgetState.overdueCount,
            ),
        style =
            TextStyle(
                color = GlanceTheme.colors.error,
                fontSize = 11.sp,
            ),
    )
}

@Composable
private fun MediumWidgetMedicationChip(
    widgetState: MediumWidgetState,
    context: Context,
) {
    val medication = widgetState.nextMedication ?: return
    if (!widgetState.showMedication) return
    Text(
        text = context.getString(R.string.widget_medication_chip, medication),
        style =
            TextStyle(
                color = GlanceTheme.colors.secondary,
                fontSize = 11.sp,
            ),
    )
}

@Composable
private fun MediumWidgetDueItems(
    widgetState: MediumWidgetState,
    context: Context,
) {
    if (!widgetState.showDueItems) return
    widgetState.dueItems.forEach { title ->
        Text(
            text = context.getString(R.string.widget_due_item, title),
            style =
                TextStyle(
                    color = GlanceTheme.colors.onSurface,
                    fontSize = 11.sp,
                ),
        )
    }
}

@Composable
private fun WidgetProgressBar(
    percent: Int,
    modifier: GlanceModifier = GlanceModifier,
) {
    val segments = 10
    val filled = ((percent * segments) / 100).coerceIn(0, segments)
    val filledColor =
        ColorProvider(
            day = Color(0xFF4CAF50),
            night = Color(0xFF81C784),
        )
    val trackColor =
        ColorProvider(
            day = Color(0xFFE0E0E0),
            night = Color(0xFF424242),
        )
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .height(8.dp),
    ) {
        repeat(segments) { index ->
            Box(
                modifier =
                    GlanceModifier
                        .defaultWeight()
                        .fillMaxHeight()
                        .padding(start = 1.dp, end = 1.dp)
                        .background(if (index < filled) filledColor else trackColor),
            ) {}
        }
    }
}

private data class MediumWidgetState(
    val completionPercent: Int,
    val overdueCount: Int,
    val nextMedication: String?,
    val dueItems: List<String>,
    val dataLoaded: Boolean,
    val showMedication: Boolean,
    val showDueItems: Boolean,
    val showOverdue: Boolean,
) {
    val hasOverdue: Boolean = showOverdue && overdueCount > 0
    val hasMedication: Boolean = showMedication && nextMedication != null
    val hasStatusRow: Boolean = hasOverdue || hasMedication
}
