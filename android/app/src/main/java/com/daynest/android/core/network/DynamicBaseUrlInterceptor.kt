package com.daynest.android.core.network

import com.daynest.android.BuildConfig
import com.daynest.android.core.storage.ApiBaseUrlOverrideStore
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class DynamicBaseUrlInterceptor
    @Inject
    constructor(
        private val apiBaseUrlOverrideStore: ApiBaseUrlOverrideStore,
    ) : Interceptor {
        override fun intercept(chain: Interceptor.Chain): Response {
            val request = chain.request()
            val newBase =
                (apiBaseUrlOverrideStore.currentOverrideBlocking() ?: BuildConfig.API_BASE_URL).toHttpUrlOrNull()
                    ?: return chain.proceed(request)
            val basePath = newBase.encodedPath.trimEnd('/')
            val requestPath = request.url.encodedPath
            // Avoid duplicating the base path prefix when request path already includes it
            // (e.g. base "/api/" + request "/api/v1" must not produce "/api/api/v1").
            val mergedPath =
                if (basePath.isEmpty() || requestPath.startsWith("$basePath/")) {
                    requestPath
                } else {
                    "$basePath$requestPath"
                }
            val newUrl =
                request.url
                    .newBuilder()
                    .scheme(newBase.scheme)
                    .host(newBase.host)
                    .port(newBase.port)
                    .encodedPath(mergedPath)
                    .build()
            return chain.proceed(request.newBuilder().url(newUrl).build())
        }

        companion object {
            fun isValidOverride(url: String): Boolean = url.toHttpUrlOrNull() != null
        }
    }
