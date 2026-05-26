package com.daynest.android.feature.wear

import androidx.wear.protolayout.ResourceBuilders
import androidx.wear.tiles.ActionBuilders
import androidx.wear.tiles.DimensionBuilders
import androidx.wear.tiles.LayoutElementBuilders
import androidx.wear.tiles.ModifiersBuilders
import androidx.wear.tiles.RequestBuilders
import androidx.wear.tiles.TileBuilders
import androidx.wear.tiles.TileService
import androidx.wear.tiles.TimelineBuilders
import com.daynest.android.R
import com.daynest.android.data.today.TodayRepository
import com.google.common.util.concurrent.ListenableFuture
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.guava.future
import javax.inject.Inject

private typealias TileResourcesFuture = ListenableFuture<ResourceBuilders.Resources>

@AndroidEntryPoint
class DaynestTileService : TileService() {
    @Inject
    lateinit var todayRepository: TodayRepository

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onTileRequest(requestParams: RequestBuilders.TileRequest): ListenableFuture<TileBuilders.Tile> =
        serviceScope.future {
            buildTile(todayRepository.getCachedTodayResponse()?.toWearTodaySnapshot())
        }

    override fun onTileResourcesRequest(requestParams: RequestBuilders.ResourcesRequest): TileResourcesFuture =
        serviceScope.future {
            ResourceBuilders.Resources
                .Builder()
                .setVersion(RESOURCES_VERSION)
                .build()
        }

    override fun onDestroy() {
        super.onDestroy()
        serviceScope.cancel()
    }

    private fun buildTile(snapshot: WearTodaySnapshot?): TileBuilders.Tile =
        TileBuilders.Tile
            .Builder()
            .setResourcesVersion(RESOURCES_VERSION)
            .setFreshnessIntervalMillis(FRESHNESS_INTERVAL_MILLIS)
            .setTimeline(
                TimelineBuilders.Timeline
                    .Builder()
                    .addTimelineEntry(
                        TimelineBuilders.TimelineEntry
                            .Builder()
                            .setLayout(buildLayout(snapshot))
                            .build(),
                    ).build(),
            ).build()

    private fun buildLayout(snapshot: WearTodaySnapshot?): LayoutElementBuilders.Layout =
        LayoutElementBuilders.Layout
            .Builder()
            .setRoot(
                LayoutElementBuilders.Column
                    .Builder()
                    .setWidth(DimensionBuilders.expand())
                    .setHeight(DimensionBuilders.expand())
                    .setModifiers(buildClickableModifiers())
                    .addContent(buildText(getString(R.string.wear_title)))
                    .addContent(buildText(getCompletionText(snapshot)))
                    .addContent(buildText(getOverdueText(snapshot)))
                    .addContent(buildText(getMedicationText(snapshot)))
                    .build(),
            ).build()

    private fun buildClickableModifiers(): ModifiersBuilders.Modifiers =
        ModifiersBuilders.Modifiers
            .Builder()
            .setClickable(
                ModifiersBuilders.Clickable
                    .Builder()
                    .setId("open_due_items")
                    .setOnClick(buildLaunchAction())
                    .build(),
            ).build()

    private fun buildLaunchAction(): ActionBuilders.LaunchAction =
        ActionBuilders.LaunchAction
            .Builder()
            .setAndroidActivity(
                ActionBuilders.AndroidActivity
                    .Builder()
                    .setPackageName(packageName)
                    .setClassName(WearCompanionActivity::class.java.name)
                    .build(),
            ).build()

    private fun buildText(text: String): LayoutElementBuilders.Text =
        LayoutElementBuilders.Text
            .Builder()
            .setText(text)
            .build()

    private fun getCompletionText(snapshot: WearTodaySnapshot?): String =
        getString(R.string.wear_completion_percent, snapshot?.completionPercent ?: 0)

    private fun getOverdueText(snapshot: WearTodaySnapshot?): String =
        getString(
            R.string.wear_overdue_count,
            snapshot?.overdueCount ?: 0,
        )

    private fun getMedicationText(snapshot: WearTodaySnapshot?): String =
        snapshot?.nextMedication?.let {
            getString(R.string.wear_next_medication, it)
        } ?: getString(R.string.wear_next_medication_none)

    private companion object {
        const val RESOURCES_VERSION = "daynest_wear_tile_v1"
        const val FRESHNESS_INTERVAL_MILLIS = 60_000L
    }
}
