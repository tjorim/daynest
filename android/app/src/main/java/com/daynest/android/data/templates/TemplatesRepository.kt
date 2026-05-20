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

        suspend fun listChores(): Result<List<ChoreTemplateDto>> = safeApiCall { templatesApi.listChores() }

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
    }
