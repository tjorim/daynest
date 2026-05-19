package com.daynest.android.core.network

import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class DynamicBaseUrlInterceptor
    @Inject
    constructor(
        private val serverUrlHolder: ServerUrlHolder,
    ) : Interceptor {
        override fun intercept(chain: Interceptor.Chain): Response {
            val request = chain.request()
            val newBase = serverUrlHolder.currentUrl.toHttpUrlOrNull()
                ?: return chain.proceed(request)
            val newUrl =
                request.url
                    .newBuilder()
                    .scheme(newBase.scheme)
                    .host(newBase.host)
                    .port(newBase.port)
                    .encodedPath(newBase.encodedPath.trimEnd('/') + request.url.encodedPath)
                    .build()
            return chain.proceed(request.newBuilder().url(newUrl).build())
        }
    }
