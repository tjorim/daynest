package com.daynest.android.data.medication

import com.daynest.android.data.safeApiCall
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class MedicationRepository
    @Inject
    constructor(
        private val medicationApi: MedicationApi,
    ) {
        suspend fun listPlans(): Result<List<MedicationPlanDto>> = safeApiCall { medicationApi.listPlans() }

        suspend fun createPlan(request: MedicationPlanInputDto): Result<MedicationPlanDto> =
            safeApiCall { medicationApi.createPlan(request) }

        suspend fun getHistory(): Result<List<MedicationHistoryItemDto>> = safeApiCall { medicationApi.getHistory().history }
    }
