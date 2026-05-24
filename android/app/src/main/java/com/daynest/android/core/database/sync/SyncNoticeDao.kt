package com.daynest.android.core.database.sync

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface SyncNoticeDao {
    @Query("SELECT * FROM sync_notices WHERE consumedAtEpochMillis IS NULL ORDER BY id ASC")
    fun observeUnconsumed(): Flow<List<SyncNoticeEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(entity: SyncNoticeEntity)

    @Query("UPDATE sync_notices SET consumedAtEpochMillis = :consumedAtEpochMillis WHERE id = :id")
    suspend fun markConsumed(
        id: Long,
        consumedAtEpochMillis: Long,
    )
}
