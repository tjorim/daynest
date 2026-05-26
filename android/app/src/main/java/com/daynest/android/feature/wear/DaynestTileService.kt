package com.daynest.android.feature.wear

import androidx.wear.tiles.ActionBuilders
import androidx.wear.tiles.DimensionBuilders
import androidx.wear.tiles.LayoutElementBuilders
import androidx.wear.tiles.ModifiersBuilders
import androidx.wear.tiles.RequestBuilders
import androidx.wear.tiles.TileBuilders
import androidx.wear.tiles.TileService
import androidx.wear.tiles.TimelineBuilders
import androidx.wear.protolayout.ResourceBuilders
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

@AndroidEntryPoint
class DaynestTileService : TileService() {
    @Inject
    lateinit var todayRepository: TodayRepository

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onTileRequest(requestParams: RequestBuilders.TileRequest): ListenableFuture<TileBuilders.Tile> =
        serviceScope.future {
            buildTile(loadSnapshot())
        }

    override fun onTileResourcesRequest(
        requestParams: RequestBuilders.ResourcesRequest,
    ): ListenableFuture<ResourceBuilders.Resources> =
        serviceScope.future {
            ResourceBuilders.Resources.Builder().setVersion(RESOURCES_VERSION).build()
        }

    override fun onDestroy() {
        super.onDestroy()
        serviceScope.cancel()
    }

    private fun buildTile(snapshot: WearTodaySnapshot?): TileBuilders.Tile {
        val layout =
            LayoutElementBuilders.Layout.Builder()
                .setRoot(
                    LayoutElementBuilders.Column.Builder()
                        .setWidth(DimensionBuilders.expand())
                        .setHeight(DimensionBuilders.expand())
                        .setModifiers(
                            ModifiersBuilders.Modifiers.Builder()
                                .setClickable(
                                    ModifiersBuilders.Clickable.Builder()
                                        .setId("open_due_items")
                                        .setOnClick(
                                            ActionBuilders.LaunchAction.Builder()
                                                .setAndroidActivity(
                                                    ActionBuilders.AndroidActivity.Builder()
                                                        .setPackageName(packageName)
                                                        .setClassName(WearCompanionActivity::class.java.name)
                                                        .build(),
                                                ).build(),
                                        ).build(),
                                ).build(),
                        ).addContent(
                            LayoutElementBuilders.Text.Builder()
                                .setText(getString(R.string.wear_title))
                                .build(),
                        ).addContent(
                            LayoutElementBuilders.Text.Builder()
                                .setText(
                                    getString(
                                        R.string.wear_completion_percent,
                                        snapshot?.completionPercent ?: 0,
                                    ),
                                ).build(),
                        ).addContent(
                            LayoutElementBuilders.Text.Builder()
                                .setText(
                                    getString(
                                        R.string.wear_overdue_count,
                                        snapshot?.overdueCount ?: 0,
                                    ),
                                ).build(),
                        ).addContent(
                            LayoutElementBuilders.Text.Builder()
                                .setText(
                                    snapshot?.nextMedication?.let {
                                        getString(R.string.wear_next_medication, it)
                                    } ?: getString(R.string.wear_next_medication_none),
                                ).build(),
                        ).build(),
                ).build()

        return TileBuilders.Tile.Builder()
            .setResourcesVersion(RESOURCES_VERSION)
            .setFreshnessIntervalMillis(60_000)
            .setTimeline(
                TimelineBuilders.Timeline.Builder()
                    .addTimelineEntry(
                        TimelineBuilders.TimelineEntry.Builder()
                            .setLayout(layout)
                            .build(),
                    ).build(),
            ).build()
    }

    private suspend fun loadSnapshot(): WearTodaySnapshot? {
        return todayRepository.getCachedTodayResponse()?.toWearTodaySnapshot()
    }

    private companion object {
        const val RESOURCES_VERSION = "daynest_wear_tile_v1"
    }
}
