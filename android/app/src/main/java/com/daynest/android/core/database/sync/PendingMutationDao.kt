package com.daynest.android.core.database.sync

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface PendingMutationDao {
    @Query("SELECT COUNT(*) FROM pending_mutations")
    fun observeCount(): Flow<Int>

    @Query("SELECT * FROM pending_mutations ORDER BY id ASC")
    suspend fun listAll(): List<PendingMutationEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun enqueue(entity: PendingMutationEntity)

    @Query("DELETE FROM pending_mutations WHERE id = :id")
    suspend fun delete(id: Long)

    @Query("UPDATE pending_mutations SET attempts = :attempts WHERE id = :id")
    suspend fun updateAttempts(
        id: Long,
        attempts: Int,
    )

    @Query("UPDATE pending_mutations SET remoteAppliedAtEpochMillis = :appliedAtEpochMillis WHERE id = :id")
    suspend fun markRemoteApplied(
        id: Long,
        appliedAtEpochMillis: Long,
    )
}
