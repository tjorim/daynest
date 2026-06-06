package com.daynest.android.data

import kotlinx.coroutines.CancellationException
import java.io.IOException

suspend fun <T> safeApiCall(call: suspend () -> T): Result<T> =
    runCatching { call() }
        .onFailure { if (it is CancellationException) throw it }

suspend inline fun <T> Result<T>.recoverOffline(crossinline fallback: suspend () -> T): Result<T> {
    if (isSuccess) return this
    return if (exceptionOrNull() is IOException) {
        runCatching { fallback() }
            .onFailure { if (it is CancellationException) throw it }
    } else {
        this
    }
}
