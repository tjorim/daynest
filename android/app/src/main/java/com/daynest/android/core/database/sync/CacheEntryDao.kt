package com.daynest.android.core.database.sync

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface CacheEntryDao {
    @Query("SELECT * FROM cache_entries WHERE cacheKey = :cacheKey")
    fun observe(cacheKey: String): Flow<CacheEntryEntity?>

    @Query("SELECT * FROM cache_entries WHERE cacheKey = :cacheKey")
    suspend fun get(cacheKey: String): CacheEntryEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entry: CacheEntryEntity)
}
