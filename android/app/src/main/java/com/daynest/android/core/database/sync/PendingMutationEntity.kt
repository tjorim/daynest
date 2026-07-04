package com.daynest.android.core.database.sync

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "pending_mutations")
data class PendingMutationEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val kind: String,
    val payload: String,
    val createdAtEpochMillis: Long,
    val attempts: Int = 0,
    val remoteAppliedAtEpochMillis: Long? = null
)
