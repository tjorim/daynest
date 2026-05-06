package com.daynest.android.core.database

import androidx.room.Database
import androidx.room.RoomDatabase
import com.daynest.android.core.database.today.TodaySummaryDao
import com.daynest.android.core.database.today.TodaySummaryEntity

@Database(entities = [TodaySummaryEntity::class], version = 1, exportSchema = false)
abstract class DaynestDatabase : RoomDatabase() {
    abstract fun todaySummaryDao(): TodaySummaryDao
}
