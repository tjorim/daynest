package com.daynest.android.core.network

import com.daynest.android.core.auth.OidcAuthService
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthInterceptor @Inject constructor(
    private val oidcAuthService: OidcAuthService,
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val token = oidcAuthService.currentAccessToken
        val request = if (!token.isNullOrBlank()) {
            chain.request().newBuilder()
                .header("Authorization", "Bearer $token")
                .build()
        } else {
            chain.request()
        }
        return chain.proceed(request)
    }
}
