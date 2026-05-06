package com.daynest.android.core.database.today

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "today_summary")
data class TodaySummaryEntity(
    @PrimaryKey val id: Int = 0,
    val routinesCount: Int,
    val choresCount: Int,
    val medicationsCount: Int,
    val plannedPendingCount: Int,
    val lastFetchedEpochMillis: Long,
)
