package com.daynest.android.core.network

import com.daynest.android.BuildConfig
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ServerUrlHolder
    @Inject
    constructor() {
        @Volatile
        var currentUrl: String = BuildConfig.API_BASE_URL.ensureTrailingSlash()
            private set

        fun updateUrl(url: String?) {
            currentUrl = (url?.takeIf { it.isNotBlank() } ?: BuildConfig.API_BASE_URL).ensureTrailingSlash()
        }
    }

private fun String.ensureTrailingSlash(): String = if (endsWith('/')) this else "$this/"
