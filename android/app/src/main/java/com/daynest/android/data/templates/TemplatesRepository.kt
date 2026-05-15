package com.daynest.android.data.templates

import kotlinx.coroutines.CancellationException
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TemplatesRepository
    @Inject
    constructor(
        private val templatesApi: TemplatesApi,
    ) {
        @Suppress("TooGenericExceptionCaught")
        suspend fun listRoutines(): Result<List<RoutineTemplateDto>> =
            try {
                Result.success(templatesApi.listRoutines())
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                Result.failure(e)
            }

        @Suppress("TooGenericExceptionCaught")
        suspend fun createRoutine(request: RoutineTemplateInputDto): Result<RoutineTemplateDto> =
            try {
                Result.success(templatesApi.createRoutine(request))
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                Result.failure(e)
            }

        @Suppress("TooGenericExceptionCaught")
        suspend fun deleteRoutine(id: Int): Result<Unit> =
            try {
                templatesApi.deleteRoutine(id)
                Result.success(Unit)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                Result.failure(e)
            }

        @Suppress("TooGenericExceptionCaught")
        suspend fun listChores(): Result<List<ChoreTemplateDto>> =
            try {
                Result.success(templatesApi.listChores())
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                Result.failure(e)
            }

        @Suppress("TooGenericExceptionCaught")
        suspend fun createChore(request: ChoreTemplateInputDto): Result<ChoreTemplateDto> =
            try {
                Result.success(templatesApi.createChore(request))
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                Result.failure(e)
            }

        @Suppress("TooGenericExceptionCaught")
        suspend fun deleteChore(id: Int): Result<Unit> =
            try {
                templatesApi.deleteChore(id)
                Result.success(Unit)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                Result.failure(e)
            }
    }
