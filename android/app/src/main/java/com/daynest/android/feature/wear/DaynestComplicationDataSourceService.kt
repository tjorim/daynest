package com.daynest.android.feature.wear

import android.app.PendingIntent
import android.content.Intent
import androidx.wear.watchface.complications.data.ComplicationData
import androidx.wear.watchface.complications.data.ComplicationType
import androidx.wear.watchface.complications.data.PlainComplicationText
import androidx.wear.watchface.complications.data.ShortTextComplicationData
import androidx.wear.watchface.complications.datasource.ComplicationRequest
import androidx.wear.watchface.complications.datasource.SuspendingComplicationDataSourceService
import com.daynest.android.R
import com.daynest.android.data.today.TodayRepository
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
class DaynestComplicationDataSourceService : SuspendingComplicationDataSourceService() {
    @Inject
    lateinit var todayRepository: TodayRepository

    override suspend fun onComplicationRequest(request: ComplicationRequest): ComplicationData? {
        val snapshot = loadSnapshot()
        val text =
            if ((snapshot?.overdueCount ?: 0) > 0) {
                getString(R.string.wear_overdue_short, snapshot?.overdueCount ?: 0)
            } else {
                getString(R.string.wear_completion_short, snapshot?.completionPercent ?: 0)
            }
        return shortTextComplication(text)
    }

    override fun getPreviewData(type: ComplicationType): ComplicationData? =
        shortTextComplication(getString(R.string.wear_completion_short, 75))

    private fun shortTextComplication(text: String): ComplicationData {
        val openIntent =
            PendingIntent.getActivity(
                this,
                1001,
                Intent(this, WearCompanionActivity::class.java),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        return ShortTextComplicationData.Builder(
            text = PlainComplicationText.Builder(text).build(),
            contentDescription = PlainComplicationText.Builder(getString(R.string.wear_title)).build(),
        ).setTapAction(openIntent).build()
    }

    private suspend fun loadSnapshot(): WearTodaySnapshot? {
        return todayRepository.getCachedTodayResponse()?.toWearTodaySnapshot()
    }
}
