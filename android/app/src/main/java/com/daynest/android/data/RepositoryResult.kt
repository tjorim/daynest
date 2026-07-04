package com.daynest.android.data

import java.io.IOException
import kotlinx.coroutines.CancellationException

suspend fun <T> safeApiCall(call: suspend () -> T): Result<T> = runCatching { call() }
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
