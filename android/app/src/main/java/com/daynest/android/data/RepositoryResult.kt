package com.daynest.android.data

import kotlinx.coroutines.CancellationException
import java.io.IOException

@Suppress("TooGenericExceptionCaught")
suspend fun <T> safeApiCall(call: suspend () -> T): Result<T> =
    try {
        Result.success(call())
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        Result.failure(e)
    }

suspend inline fun <T> Result<T>.recoverOffline(crossinline fallback: suspend () -> T): Result<T> {
    if (isSuccess) return this
    return if (exceptionOrNull() is IOException) {
        try {
            Result.success(fallback())
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            Result.failure(e)
        }
    } else {
        this
    }
}
