package com.daynest.android.data.mealplan

import com.daynest.android.core.database.sync.CacheEntryDao
import com.daynest.android.core.database.sync.CacheEntryEntity
import com.daynest.android.core.network.JsonSerializer
import com.daynest.android.data.recoverOffline
import com.daynest.android.data.safeApiCall
import com.daynest.android.data.sync.SyncCacheKeys
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.encodeToString
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class MealPlanRepository
    @Inject
    constructor(
        private val mealPlanApi: MealPlanApi,
        private val cacheEntryDao: CacheEntryDao,
    ) {
        suspend fun listMealPlans(): Result<List<MealPlanDto>> =
            safeApiCall { mealPlanApi.listMealPlans() }
                .onSuccess { plans -> cacheMealPlans(plans) }
                .recoverOffline { cachedMealPlans() }

        suspend fun createMealPlan(request: MealPlanCreateDto): Result<MealPlanDto> =
            safeApiCall { mealPlanApi.createMealPlan(request) }
                .onSuccess { plan -> upsertCachedMealPlan(plan) }

        suspend fun getWeekPlan(mealPlanId: Int): Result<WeekGridDto> {
            val cacheKey = weekCacheKey(mealPlanId)
            return safeApiCall { mealPlanApi.getWeekPlan(mealPlanId) }
                .onSuccess { week ->
                    cacheEntryDao.upsert(
                        CacheEntryEntity(
                            cacheKey = cacheKey,
                            payload = JsonSerializer.config.encodeToString(WeekGridDto.serializer(), week),
                            updatedAtEpochMillis = System.currentTimeMillis(),
                        ),
                    )
                    upsertCachedMealPlan(week.mealPlan)
                }.recoverOffline {
                    cacheEntryDao.get(cacheKey)?.payload?.let { payload ->
                        JsonSerializer.config.decodeFromString(WeekGridDto.serializer(), payload)
                    } ?: error("Meal plan week $mealPlanId not found in cache")
                }
        }

        suspend fun updateSlot(
            mealPlanId: Int,
            slotId: Int,
            request: MealSlotUpdateDto,
        ): Result<MealSlotDto> =
            safeApiCall { mealPlanApi.updateSlot(mealPlanId, slotId, request) }
                .onSuccess { slot -> upsertCachedSlot(mealPlanId, slot) }

        suspend fun generateShoppingList(mealPlanId: Int): Result<GenerateShoppingListDto> =
            safeApiCall { mealPlanApi.generateShoppingList(mealPlanId) }

        private suspend fun cacheMealPlans(plans: List<MealPlanDto>) {
            cacheEntryDao.upsert(
                CacheEntryEntity(
                    cacheKey = SyncCacheKeys.MEAL_PLANS,
                    payload = JsonSerializer.config.encodeToString(ListSerializer(MealPlanDto.serializer()), plans),
                    updatedAtEpochMillis = System.currentTimeMillis(),
                ),
            )
        }

        private suspend fun cachedMealPlans(): List<MealPlanDto> =
            cacheEntryDao.get(SyncCacheKeys.MEAL_PLANS)?.payload?.let { payload ->
                JsonSerializer.config.decodeFromString(ListSerializer(MealPlanDto.serializer()), payload)
            } ?: emptyList()

        private suspend fun upsertCachedMealPlan(plan: MealPlanDto) {
            val updated =
                (cachedMealPlans().filterNot { it.id == plan.id } + plan)
                    .sortedByDescending { it.weekStart }
            cacheMealPlans(updated)
        }

        private suspend fun upsertCachedSlot(
            mealPlanId: Int,
            slot: MealSlotDto,
        ) {
            val cacheKey = weekCacheKey(mealPlanId)
            val cachedWeek =
                cacheEntryDao.get(cacheKey)?.payload?.let { payload ->
                    JsonSerializer.config.decodeFromString(WeekGridDto.serializer(), payload)
                } ?: return
            val updatedWeek =
                cachedWeek.copy(
                    days =
                        cachedWeek.days.map { day ->
                            if (day.date == slot.slotDate) {
                                day.copy(slots = day.slots + (slot.slotType to slot))
                            } else {
                                day
                            }
                        },
                )
            cacheEntryDao.upsert(
                CacheEntryEntity(
                    cacheKey = cacheKey,
                    payload = JsonSerializer.config.encodeToString(WeekGridDto.serializer(), updatedWeek),
                    updatedAtEpochMillis = System.currentTimeMillis(),
                ),
            )
        }

        private fun weekCacheKey(mealPlanId: Int): String = "${SyncCacheKeys.MEAL_SLOTS}:$mealPlanId"
    }
