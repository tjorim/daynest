package com.daynest.android.core.network

import com.daynest.android.BuildConfig

object ApiConfig {
    val baseUrl: String = BuildConfig.API_BASE_URL.ensureTrailingSlash()
}

private fun String.ensureTrailingSlash(): String = if (endsWith('/')) this else "$this/"
