package com.daynest.android.core.database.sync

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "cache_entries")
data class CacheEntryEntity(@PrimaryKey val cacheKey: String, val payload: String, val updatedAtEpochMillis: Long)
