package com.daynest.android.data

import kotlinx.coroutines.CancellationException

@Suppress("TooGenericExceptionCaught")
suspend fun <T> safeApiCall(call: suspend () -> T): Result<T> = try {
    Result.success(call())
} catch (e: CancellationException) {
    throw e
} catch (e: Exception) {
    Result.failure(e)
}
