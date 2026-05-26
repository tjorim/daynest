package com.daynest.android.data.today

import com.daynest.android.core.database.sync.CacheEntryDao
import com.daynest.android.core.database.sync.CacheEntryEntity
import com.daynest.android.core.network.JsonSerializer
import com.daynest.android.data.sync.SyncCacheKeys
import kotlinx.serialization.encodeToString
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TodayRepository
    @Inject
    constructor(
        private val todayApi: TodayApi,
        private val todayActionsApi: TodayActionsApi,
        private val cacheEntryDao: CacheEntryDao,
    ) {
        suspend fun getCachedTodayResponse(): TodayResponseDto? {
            val entry = cacheEntryDao.get(SyncCacheKeys.TODAY) ?: return null
            return runCatching {
                JsonSerializer.config.decodeFromString(TodayResponseDto.serializer(), entry.payload)
            }.getOrNull()
        }

        suspend fun refresh(): Result<Unit> =
            try {
                val today = todayApi.getToday()
                cacheEntryDao.upsert(
                    CacheEntryEntity(
                        cacheKey = SyncCacheKeys.TODAY,
                        payload = JsonSerializer.config.encodeToString(TodayResponseDto.serializer(), today),
                        updatedAtEpochMillis = System.currentTimeMillis(),
                    ),
                )
                Result.success(Unit)
            } catch (e: IOException) {
                Result.failure(e)
            } catch (e: IllegalStateException) {
                Result.failure(e)
            }

        suspend fun completeChore(choreInstanceId: Int): Result<ChoreMutationDto> =
            runCatching {
                todayActionsApi.completeChore(choreInstanceId)
            }

        suspend fun takeDose(doseInstanceId: Int): Result<DoseMutationDto> =
            runCatching {
                todayActionsApi.takeDose(doseInstanceId)
            }
    }
