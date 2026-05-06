package com.daynest.android.core.network

import com.daynest.android.core.storage.SecureTokenStorage
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthInterceptor
    @Inject
    constructor(
        private val storage: SecureTokenStorage,
    ) : Interceptor {
        override fun intercept(chain: Interceptor.Chain): Response {
            val requestBuilder = chain.request().newBuilder()
            val token = storage.cachedToken
            if (!token.isNullOrBlank()) {
                requestBuilder.addHeader("Authorization", "Bearer $token")
            }
            return chain.proceed(requestBuilder.build())
        }
    }
