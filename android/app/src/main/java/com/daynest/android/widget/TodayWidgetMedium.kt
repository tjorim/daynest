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

    val completionPercent = prefs[TodayWidgetStateKeys.COMPLETION_PERCENT] ?: 0
    val overdueCount = prefs[TodayWidgetStateKeys.OVERDUE_COUNT] ?: 0
    val nextMedication = prefs[TodayWidgetStateKeys.NEXT_MEDICATION_NAME]
    val dueItem0 = prefs[TodayWidgetStateKeys.DUE_ITEM_0]
    val dueItem1 = prefs[TodayWidgetStateKeys.DUE_ITEM_1]
    val dueItem2 = prefs[TodayWidgetStateKeys.DUE_ITEM_2]
    val dataLoaded = prefs[TodayWidgetStateKeys.DATA_LOADED] ?: false
    val showMedication = prefs[TodayWidgetStateKeys.SHOW_MEDICATION] ?: true
    val showDueItems = prefs[TodayWidgetStateKeys.SHOW_DUE_ITEMS] ?: true
    val showOverdue = prefs[TodayWidgetStateKeys.SHOW_OVERDUE] ?: true

    val launchIntent =
        Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }

    GlanceTheme {
        Box(
            modifier =
                GlanceModifier
                    .fillMaxSize()
                    .background(GlanceTheme.colors.surface)
                    .clickable(actionStartActivity(launchIntent))
                    .padding(12.dp),
        ) {
            if (!dataLoaded) {
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
            } else {
                Column(modifier = GlanceModifier.fillMaxSize()) {
                    // Title row: "Today" on the left, "75% done" on the right
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
                            text = context.getString(R.string.widget_completion_done, completionPercent),
                            style =
                                TextStyle(
                                    color = GlanceTheme.colors.primary,
                                    fontSize = 12.sp,
                                ),
                        )
                    }

                    Spacer(modifier = GlanceModifier.height(6.dp))

                    // Segmented progress bar (10 equal segments)
                    WidgetProgressBar(percent = completionPercent)

                    Spacer(modifier = GlanceModifier.height(6.dp))

                    // Status row: overdue badge + medication chip
                    val hasOverdue = showOverdue && overdueCount > 0
                    val hasMedication = showMedication && nextMedication != null
                    if (hasOverdue || hasMedication) {
                        Row(
                            modifier = GlanceModifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            if (hasOverdue) {
                                Text(
                                    text =
                                        context.resources.getQuantityString(
                                            R.plurals.widget_overdue_count,
                                            overdueCount,
                                            overdueCount,
                                        ),
                                    style =
                                        TextStyle(
                                            color = GlanceTheme.colors.error,
                                            fontSize = 11.sp,
                                        ),
                                )
                                if (hasMedication) {
                                    Spacer(modifier = GlanceModifier.defaultWeight())
                                }
                            }
                            if (hasMedication) {
                                Text(
                                    text = context.getString(R.string.widget_medication_chip, nextMedication),
                                    style =
                                        TextStyle(
                                            color = GlanceTheme.colors.secondary,
                                            fontSize = 11.sp,
                                        ),
                                )
                            }
                        }
                        Spacer(modifier = GlanceModifier.height(4.dp))
                    }

                    // Top due items
                    if (showDueItems) {
                        listOfNotNull(dueItem0, dueItem1, dueItem2).forEach { title ->
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
                }
            }
        }
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
