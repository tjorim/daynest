package com.daynest.android.data.medication

import kotlinx.coroutines.CancellationException
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class MedicationRepository
    @Inject
    constructor(
        private val medicationApi: MedicationApi,
    ) {
        @Suppress("TooGenericExceptionCaught")
        suspend fun listPlans(): Result<List<MedicationPlanDto>> =
            try {
                Result.success(medicationApi.listPlans())
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                Result.failure(e)
            }

        @Suppress("TooGenericExceptionCaught")
        suspend fun createPlan(request: MedicationPlanInputDto): Result<MedicationPlanDto> =
            try {
                Result.success(medicationApi.createPlan(request))
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                Result.failure(e)
            }

        @Suppress("TooGenericExceptionCaught")
        suspend fun getHistory(): Result<List<MedicationHistoryItemDto>> =
            try {
                Result.success(medicationApi.getHistory().history)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                Result.failure(e)
            }
    }
