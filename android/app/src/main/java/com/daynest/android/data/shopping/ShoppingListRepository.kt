package com.daynest.android.data.shopping

import android.content.Context
import com.daynest.android.core.database.sync.CacheEntryDao
import com.daynest.android.core.database.sync.CacheEntryEntity
import com.daynest.android.core.database.sync.PendingMutationDao
import com.daynest.android.core.database.sync.PendingMutationEntity
import com.daynest.android.core.network.JsonSerializer
import com.daynest.android.data.safeApiCall
import com.daynest.android.data.sync.CreateShoppingListPayload
import com.daynest.android.data.sync.DaynestSyncScheduler
import com.daynest.android.data.sync.DeleteShoppingListPayload
import com.daynest.android.data.sync.PendingMutationKind
import com.daynest.android.data.sync.SyncCacheKeys
import com.daynest.android.data.sync.UpdateShoppingListPayload
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.encodeToString
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.random.Random

@Singleton
class ShoppingListRepository
    @Inject
    constructor(
        private val shoppingListApi: ShoppingListApi,
        private val cacheEntryDao: CacheEntryDao,
        private val pendingMutationDao: PendingMutationDao,
        @ApplicationContext private val appContext: Context,
    ) {
        suspend fun listShoppingLists(status: String = ShoppingListStatus.ALL): Result<List<ShoppingListDto>> =
            safeApiCall { shoppingListApi.listShoppingLists(status) }
                .onSuccess { lists ->
                    if (status == ShoppingListStatus.ALL) {
                        cacheShoppingLists(lists)
                    } else {
                        val merged = cachedShoppingLists().filterNot { cached -> lists.any { it.id == cached.id } } + lists
                        cacheShoppingLists(merged)
                    }
                }
                .recoverOffline {
                    cacheEntryDao.get(SyncCacheKeys.SHOPPING_LISTS)?.payload?.let { payload ->
                        JsonSerializer.config.decodeFromString(
                            ListSerializer(ShoppingListDto.serializer()),
                            payload,
                        )
                    }?.filter { status == ShoppingListStatus.ALL || it.status == status } ?: emptyList()
                }

        suspend fun getShoppingList(id: Int): Result<ShoppingListDto> =
            safeApiCall { shoppingListApi.getShoppingList(id) }
                .onSuccess { list -> upsertCachedShoppingList(list) }
                .recoverOffline {
                    cachedShoppingLists().firstOrNull { it.id == id }
                        ?: error("Shopping list $id not found in cache")
                }

        suspend fun createShoppingList(request: ShoppingListCreateDto): Result<ShoppingListDto> =
            safeApiCall { shoppingListApi.createShoppingList(request).also { scheduleSync() } }
                .recoverOffline {
                    enqueue(PendingMutationKind.CREATE_SHOPPING_LIST, CreateShoppingListPayload(request))
                    scheduleSync()
                    ShoppingListDto(
                        id = -Random.nextInt(1, Int.MAX_VALUE),
                        userId = 0,
                        name = request.name,
                        store = request.store,
                        notes = request.notes,
                        status = ShoppingListStatus.ACTIVE,
                    ).also { upsertCachedShoppingList(it) }
                }

        suspend fun updateShoppingList(
            id: Int,
            request: ShoppingListUpdateDto,
        ): Result<ShoppingListDto> =
            safeApiCall { shoppingListApi.updateShoppingList(id, request).also { scheduleSync() } }
                .recoverOffline {
                    enqueue(PendingMutationKind.UPDATE_SHOPPING_LIST, UpdateShoppingListPayload(id, request))
                    scheduleSync()
                    val current = cachedShoppingLists().firstOrNull { it.id == id }
                        ?: error("Shopping list $id not found in cache")
                    current.copy(
                        name = request.name ?: current.name,
                        store = request.store ?: current.store,
                        notes = request.notes ?: current.notes,
                        status = request.status ?: current.status,
                    ).also { upsertCachedShoppingList(it) }
                }

        suspend fun deleteShoppingList(id: Int): Result<Unit> =
            safeApiCall { shoppingListApi.deleteShoppingList(id).also { scheduleSync() } }
                .recoverOffline {
                    enqueue(PendingMutationKind.DELETE_SHOPPING_LIST, DeleteShoppingListPayload(id))
                    scheduleSync()
                    cacheShoppingLists(cachedShoppingLists().filterNot { it.id == id })
                    Unit
                }

        internal suspend fun cacheShoppingLists(lists: List<ShoppingListDto>) {
            cacheEntryDao.upsert(
                CacheEntryEntity(
                    cacheKey = SyncCacheKeys.SHOPPING_LISTS,
                    payload = JsonSerializer.config.encodeToString(ListSerializer(ShoppingListDto.serializer()), lists),
                    updatedAtEpochMillis = System.currentTimeMillis(),
                ),
            )
        }

        private suspend fun cachedShoppingLists(): List<ShoppingListDto> =
            cacheEntryDao.get(SyncCacheKeys.SHOPPING_LISTS)?.payload?.let { payload ->
                JsonSerializer.config.decodeFromString(ListSerializer(ShoppingListDto.serializer()), payload)
            } ?: emptyList()

        private suspend fun upsertCachedShoppingList(list: ShoppingListDto) {
            val next = cachedShoppingLists().filterNot { it.id == list.id } + list
            cacheShoppingLists(next.sortedBy { it.name.lowercase() })
        }

        private suspend inline fun <reified T : Any> enqueue(
            kind: PendingMutationKind,
            payload: T,
        ) {
            pendingMutationDao.enqueue(
                PendingMutationEntity(
                    kind = kind.name,
                    payload = JsonSerializer.config.encodeToString(payload),
                    createdAtEpochMillis = System.currentTimeMillis(),
                ),
            )
        }

        private fun scheduleSync() {
            DaynestSyncScheduler.enqueueOneShot(appContext)
        }

        private suspend inline fun <T> Result<T>.recoverOffline(crossinline fallback: suspend () -> T): Result<T> {
            if (isSuccess) return this
            val failure = exceptionOrNull()
            return if (failure is IOException) {
                runCatching { fallback() }
            } else {
                this
            }
        }
    }
