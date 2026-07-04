package com.daynest.android.core.database

import androidx.room.Database
import androidx.room.RoomDatabase
import com.daynest.android.core.database.sync.CacheEntryDao
import com.daynest.android.core.database.sync.CacheEntryEntity

@Database(
    entities = [CacheEntryEntity::class],
    version = 1,
    exportSchema = false
)
abstract class DaynestWearDatabase : RoomDatabase() {
    abstract fun cacheEntryDao(): CacheEntryDao
}
