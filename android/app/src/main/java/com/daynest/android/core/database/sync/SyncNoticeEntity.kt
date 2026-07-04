package com.daynest.android.core.database.sync

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "sync_notices")
data class SyncNoticeEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val message: String,
    val createdAtEpochMillis: Long,
    val consumedAtEpochMillis: Long? = null
)
