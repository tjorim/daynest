package com.daynest.android.data.templates

import com.daynest.android.data.safeApiCall
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TemplatesRepository
    @Inject
    constructor(
        private val templatesApi: TemplatesApi,
    ) {
        suspend fun listRoutines(): Result<List<RoutineTemplateDto>> = safeApiCall { templatesApi.listRoutines() }

        suspend fun createRoutine(request: RoutineTemplateInputDto): Result<RoutineTemplateDto> =
            safeApiCall { templatesApi.createRoutine(request) }

        suspend fun deleteRoutine(id: Int): Result<Unit> =
            safeApiCall {
                templatesApi.deleteRoutine(id)
                Unit
            }

        suspend fun listChores(): Result<List<ChoreTemplateDto>> = safeApiCall { templatesApi.listChores() }

        suspend fun createChore(request: ChoreTemplateInputDto): Result<ChoreTemplateDto> =
            safeApiCall { templatesApi.createChore(request) }

        suspend fun deleteChore(id: Int): Result<Unit> =
            safeApiCall {
                templatesApi.deleteChore(id)
                Unit
            }
    }
