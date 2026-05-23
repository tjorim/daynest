package com.daynest.android.data.templates

import com.daynest.android.core.database.sync.CacheEntryDao
import com.daynest.android.core.database.sync.CacheEntryEntity
import com.daynest.android.core.network.JsonSerializer
import com.daynest.android.data.sync.SyncCacheKeys
import com.daynest.android.data.safeApiCall
import java.io.IOException
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.encodeToString
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TemplatesRepository
    @Inject
    constructor(
        private val templatesApi: TemplatesApi,
        private val cacheEntryDao: CacheEntryDao,
    ) {
        suspend fun listRoutines(): Result<List<RoutineTemplateDto>> =
            safeApiCall { templatesApi.listRoutines() }
                .onSuccess { routines ->
                    cacheEntryDao.upsert(
                        CacheEntryEntity(
                            cacheKey = SyncCacheKeys.ROUTINE_TEMPLATES,
                            payload =
                                JsonSerializer.config.encodeToString(
                                    ListSerializer(RoutineTemplateDto.serializer()),
                                    routines,
                                ),
                            updatedAtEpochMillis = System.currentTimeMillis(),
                        ),
                    )
                }.recoverCatchingOffline {
                    cacheEntryDao.get(SyncCacheKeys.ROUTINE_TEMPLATES)?.payload?.let { payload ->
                        JsonSerializer.config.decodeFromString(
                            ListSerializer(RoutineTemplateDto.serializer()),
                            payload,
                        )
                    } ?: emptyList()
                }

        suspend fun createRoutine(request: RoutineTemplateInputDto): Result<RoutineTemplateDto> =
            safeApiCall { templatesApi.createRoutine(request) }

        @Suppress("ktlint:standard:function-signature")
        suspend fun updateRoutine(
            id: Int,
            request: RoutineTemplateInputDto,
        ): Result<RoutineTemplateDto> =
            safeApiCall { templatesApi.updateRoutine(id, request) }

        suspend fun deleteRoutine(id: Int): Result<Unit> =
            safeApiCall {
                templatesApi.deleteRoutine(id)
                Unit
            }

        suspend fun listChores(): Result<List<ChoreTemplateDto>> =
            safeApiCall { templatesApi.listChores() }
                .onSuccess { chores ->
                    cacheEntryDao.upsert(
                        CacheEntryEntity(
                            cacheKey = SyncCacheKeys.CHORE_TEMPLATES,
                            payload =
                                JsonSerializer.config.encodeToString(
                                    ListSerializer(ChoreTemplateDto.serializer()),
                                    chores,
                                ),
                            updatedAtEpochMillis = System.currentTimeMillis(),
                        ),
                    )
                }.recoverCatchingOffline {
                    cacheEntryDao.get(SyncCacheKeys.CHORE_TEMPLATES)?.payload?.let { payload ->
                        JsonSerializer.config.decodeFromString(
                            ListSerializer(ChoreTemplateDto.serializer()),
                            payload,
                        )
                    } ?: emptyList()
                }

        suspend fun createChore(request: ChoreTemplateInputDto): Result<ChoreTemplateDto> =
            safeApiCall { templatesApi.createChore(request) }

        @Suppress("ktlint:standard:function-signature")
        suspend fun updateChore(
            id: Int,
            request: ChoreTemplateInputDto,
        ): Result<ChoreTemplateDto> =
            safeApiCall { templatesApi.updateChore(id, request) }

        suspend fun deleteChore(id: Int): Result<Unit> =
            safeApiCall {
                templatesApi.deleteChore(id)
                Unit
            }

private suspend inline fun <T> Result<T>.recoverCatchingOffline(
            crossinline fallback: suspend () -> T,
): Result<T> {
            if (isSuccess) return this
            val failure = exceptionOrNull()
            return if (failure is IOException) {
                runCatching { fallback() }
            } else {
                this
            }
}
    }
