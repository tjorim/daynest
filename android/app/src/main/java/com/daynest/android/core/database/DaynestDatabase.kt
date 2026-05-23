package com.daynest.android.core.database

import androidx.room.Database
import androidx.room.RoomDatabase
import com.daynest.android.core.database.sync.CacheEntryDao
import com.daynest.android.core.database.sync.CacheEntryEntity
import com.daynest.android.core.database.sync.PendingMutationDao
import com.daynest.android.core.database.sync.PendingMutationEntity
import com.daynest.android.core.database.today.TodaySummaryDao
import com.daynest.android.core.database.today.TodaySummaryEntity

@Database(
    entities = [TodaySummaryEntity::class, CacheEntryEntity::class, PendingMutationEntity::class],
    version = 3,
    exportSchema = false,
)
abstract class DaynestDatabase : RoomDatabase() {
    abstract fun todaySummaryDao(): TodaySummaryDao

    abstract fun cacheEntryDao(): CacheEntryDao

    abstract fun pendingMutationDao(): PendingMutationDao
}
