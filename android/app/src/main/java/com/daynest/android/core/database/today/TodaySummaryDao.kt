package com.daynest.android.core.database.today

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface TodaySummaryDao {
    @Query("SELECT * FROM today_summary WHERE id = 0")
    fun observe(): Flow<TodaySummaryEntity?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: TodaySummaryEntity)

    @Query("DELETE FROM today_summary")
    suspend fun clear()
}
