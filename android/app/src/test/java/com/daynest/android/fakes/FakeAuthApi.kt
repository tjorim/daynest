package com.daynest.android.fakes

import com.daynest.android.data.auth.AuthApi
import com.daynest.android.data.auth.AuthSessionDto
import com.daynest.android.data.auth.SignInRequestDto

internal class FakeAuthApi : AuthApi {
    private val signInResponses: ArrayDeque<Result<AuthSessionDto>> = ArrayDeque()
    private val restoreResponses: ArrayDeque<Result<AuthSessionDto>> = ArrayDeque()

    var lastSignInRequest: SignInRequestDto? = null
        private set

    fun enqueueSignInSuccess(accessToken: String = "access-token") {
        signInResponses.addLast(Result.success(AuthSessionDto(accessToken)))
    }

    fun enqueueSignInError(error: Throwable = RuntimeException("sign-in error")) {
        signInResponses.addLast(Result.failure(error))
    }

    fun enqueueRestoreSuccess(accessToken: String = "refreshed-token") {
        restoreResponses.addLast(Result.success(AuthSessionDto(accessToken)))
    }

    fun enqueueRestoreError(error: Throwable = RuntimeException("restore error")) {
        restoreResponses.addLast(Result.failure(error))
    }

    override suspend fun signIn(request: SignInRequestDto): AuthSessionDto {
        lastSignInRequest = request
        return checkNotNull(signInResponses.removeFirstOrNull()) {
            "No queued signIn response for FakeAuthApi"
        }.getOrThrow()
    }

    override suspend fun restoreSession(): AuthSessionDto =
        checkNotNull(restoreResponses.removeFirstOrNull()) {
            "No queued restoreSession response for FakeAuthApi"
        }.getOrThrow()
}
